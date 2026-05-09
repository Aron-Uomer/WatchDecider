import express from 'express';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import dns from 'dns';

// Force Node.js to prefer IPv4 (Fixes Gmail SMTP ENETUNREACH on Render)
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const app = express();
const port = process.env.PORT || 3001;

// Trust the reverse proxy (required for express-rate-limit on Render/Heroku)
app.set('trust proxy', 1);

// 1. Firebase Initialization (supports file path OR inline JSON for production)
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (serviceAccountJson || serviceAccountPath) {
  try {
    let serviceAccount;
    if (serviceAccountJson) {
      serviceAccount = JSON.parse(serviceAccountJson);
    } else {
      const absolutePath = join(__dirname, serviceAccountPath);
      serviceAccount = require(absolutePath);
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
  }
} else {
  console.warn('⚠️ Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in .env.');
}

const db = admin.apps.length > 0 ? admin.firestore() : null;

// 2. Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  family: 4, // Force IPv4 to bypass Render's IPv6 limitation
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify SMTP Connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Error:', error.message);
  } else {
    console.log('✅ Server is ready to send emails');
  }
});

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin, or if origin is explicitly allowed, or if wildcard * is used
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// Security: Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please try again later.' }
});

// Token Generation & Auth Middleware
const generateToken = () => crypto.randomBytes(32).toString('hex');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    if (!db) throw new Error('Database not initialized');
    const sessionDoc = await db.collection('sessions').doc(token).get();
    if (!sessionDoc.exists) return res.status(401).json({ error: 'Invalid or expired session' });

    req.user = sessionDoc.data();
    req.sessionToken = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// --- ENDPOINTS ---

app.post('/api/send-verification', limiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    if (!db) throw new Error('Database not initialized');
    
    // Check if user already exists
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (!userSnapshot.empty) {
      return res.status(400).json({ error: 'This email is already linked to an account. Please login instead.' });
    }

    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash the code (using bcryptjs for better ESM compatibility)
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(rawCode, salt);
    
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // Store in Firestore
    if (db) {
      await db.collection('verificationCodes').doc(email).set({
        email,
        codeHash,
        expiresAt,
        verified: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    const mailOptions = {
      from: `"WatchDecider Portal" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify your Decider account',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6366f1;">Welcome to WatchDecider!</h2>
          <p>Please enter the following 6-digit code to verify your email address. This code will expire in 10 minutes.</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #1e293b; border-radius: 8px;">
            ${rawCode}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('📬 Verification email sent to:', email);
    
    res.status(200).json({ message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('Email Error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

app.post('/api/verify-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    if (!db) {
       return res.status(503).json({ error: 'Database not initialized' });
    }

    const doc = await db.collection('verificationCodes').doc(email).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'No active code found for this email' });
    }

    const data = doc.data();
    
    if (Date.now() > data.expiresAt) {
      return res.status(410).json({ error: 'Code has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(code, data.codeHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    await db.collection('verificationCodes').doc(email).update({
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ message: 'Email verified successfully!' });
  } catch (error) {
    console.error('Verify Error:', error);
    res.status(500).json({ error: 'Something went wrong during verification' });
  }
});

app.post('/api/resend-verification', limiter, async (req, res) => {
  // Logic is same as send
  const { email } = req.body;
  
  try {
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(rawCode, salt);
    const expiresAt = Date.now() + 10 * 60 * 1000;

    if (db) {
      await db.collection('verificationCodes').doc(email).set({
        email, codeHash, expiresAt, verified: false, 
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    const mailOptions = {
        from: `"WatchDecider Portal" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your new verification code',
        html: `<p>Your new verification code is: <b>${rawCode}</b></p>`
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Verification code resent successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

app.post('/api/auth/forgot-password', limiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    if (!db) throw new Error('Database not initialized');
    
    // Check if user exists
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (userSnapshot.empty) {
      // For security, don't reveal if user exists or not
      return res.status(200).json({ message: 'If an account exists with this email, a reset code has been sent.' });
    }

    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(rawCode, salt);
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await db.collection('verificationCodes').doc(email).set({
      email,
      codeHash,
      expiresAt,
      type: 'password_reset',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const mailOptions = {
      from: `"WatchDecider Portal" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset Code',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6366f1;">Reset your password</h2>
          <p>You requested a password reset. Please enter the following 6-digit code to continue. This code will expire in 10 minutes.</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #1e293b; border-radius: 8px;">
            ${rawCode}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'If an account exists with this email, a reset code has been sent.' });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

app.post('/api/auth/verify-reset-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  try {
    if (!db) throw new Error('Database not initialized');

    const doc = await db.collection('verificationCodes').doc(email).get();
    if (!doc.exists) return res.status(404).json({ error: 'Reset code expired or not found' });

    const data = doc.data();
    if (data.type !== 'password_reset') return res.status(400).json({ error: 'Invalid operation' });
    if (Date.now() > data.expiresAt) return res.status(410).json({ error: 'Reset code expired' });

    const isMatch = await bcrypt.compare(code, data.codeHash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid reset code' });

    // Mark as verified
    await db.collection('verificationCodes').doc(email).update({
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ message: 'Code verified successfully' });
  } catch (err) {
    console.error('Verify Reset Code Error:', err);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: 'Missing required fields' });

  try {
    if (!db) throw new Error('Database not initialized');

    // Check if verified
    const doc = await db.collection('verificationCodes').doc(email).get();
    if (!doc.exists || !doc.data().verified) {
      return res.status(403).json({ error: 'Verification required' });
    }

    const data = doc.data();
    if (data.type !== 'password_reset') return res.status(400).json({ error: 'Invalid operation' });
    // Check if verification happened recently (e.g. within 15 mins)
    const verifiedAt = data.verifiedAt ? data.verifiedAt.toMillis() : 0;
    if (Date.now() - verifiedAt > 15 * 60 * 1000) {
      return res.status(410).json({ error: 'Verification expired. Please start over.' });
    }

    // Update password
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (userSnapshot.empty) return res.status(404).json({ error: 'User not found' });

    const userDoc = userSnapshot.docs[0];
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await userDoc.ref.update({ passwordHash });

    // Clean up
    await db.collection('verificationCodes').doc(email).delete();

    res.status(200).json({ message: 'Password reset successfully. You can now login.' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.post('/api/auth/check-username', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  try {
    if (!db) throw new Error('Database not initialized');
    const snapshot = await db.collection('users').where('username', '==', username).get();
    if (!snapshot.empty) {
      return res.status(400).json({ error: 'Username already exists. Please pick another.' });
    }
    res.status(200).json({ message: 'Username is available' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const { username, password, email, code, ...additionalInfo } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Missing required fields (username, password, email)' });
  }

  try {
    if (!db) throw new Error('Database not initialized');

    // Basic format check
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Domain validation (MX record check)
    const domain = email.split('@')[1];
    try {
      const mxRecords = await dns.promises.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return res.status(400).json({ error: 'Please use a valid email address.' });
      }
    } catch (dnsError) {
      return res.status(400).json({ error: 'Please use a valid email address.' });
    }
    
    // 1. Verify the code (DISABLED due to Render SMTP limits)
    /*
    const doc = await db.collection('verificationCodes').doc(email).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'No active code found for this email' });
    }
    
    const data = doc.data();
    if (Date.now() > data.expiresAt) {
      return res.status(410).json({ error: 'Code has expired.' });
    }
    
    const isMatch = await bcrypt.compare(code, data.codeHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }
    */

    // 2. Check if username or email exists
    const usersRef = db.collection('users');
    const usernameSnapshot = await usersRef.where('username', '==', username).get();
    if (!usernameSnapshot.empty) {
      return res.status(400).json({ error: 'Username already exists. Please pick another.' });
    }

    const emailSnapshot = await usersRef.where('email', '==', email).get();
    if (!emailSnapshot.empty) {
      return res.status(400).json({ error: 'Email already registered. Please login or use another email.' });
    }

    // 3. Create User
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      username,
      passwordHash,
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...additionalInfo
    };

    const docRef = usersRef.doc(username);
    await docRef.set(newUser);
    
    // Clean up verification code (DISABLED)
    // await db.collection('verificationCodes').doc(email).delete();
    
    // Create secure session
    const token = generateToken();
    const session = {
      id: username,
      username: newUser.username,
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
      token
    };

    await db.collection('sessions').doc(token).set({
      userId: username,
      username: newUser.username,
      email: newUser.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(201).json(session);
  } catch (err) {
    console.error('Signup Error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    if (!db) throw new Error('Database not initialized');
    
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken();
    const session = {
      id: userDoc.id,
      username: user.username,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      token
    };

    await db.collection('sessions').doc(token).set({
      userId: userDoc.id,
      username: user.username,
      email: user.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json(session);
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { updates } = req.body;
  try {
    if (!db) throw new Error('Database not initialized');
    
    // If username is being updated and it's different from the current one
    if (updates.username && updates.username !== userId) {
      const newUsername = updates.username;
      
      // 1. Check if the new username is already taken
      const snapshot = await db.collection('users').where('username', '==', newUsername).get();
      if (!snapshot.empty) {
        return res.status(400).json({ error: 'Username already taken. Please pick another.' });
      }
      
      // 2. Get the current user data
      const oldDocRef = db.collection('users').doc(userId);
      const oldDoc = await oldDocRef.get();
      if (!oldDoc.exists) return res.status(404).json({ error: 'User not found' });
      const userData = oldDoc.data();
      
      // 3. Create new user document with updated data
      const updatedData = { ...userData, ...updates };
      await db.collection('users').doc(newUsername).set(updatedData);
      
      // 4. Delete the old user document
      await oldDocRef.delete();
      
      // 5. Migrate userData (likes, dislikes, seen) if it exists
      const oldUserDataRef = db.collection('userData').doc(userId);
      const oldUserDataDoc = await oldUserDataRef.get();
      if (oldUserDataDoc.exists) {
         await db.collection('userData').doc(newUsername).set(oldUserDataDoc.data());
         await oldUserDataRef.delete();
      }

      // 6. Rotate session token
      await db.collection('sessions').doc(req.sessionToken).delete();
      const newToken = generateToken();
      await db.collection('sessions').doc(newToken).set({
        userId: newUsername,
        username: updatedData.username,
        email: updatedData.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const session = {
        id: newUsername,
        username: updatedData.username,
        name: updatedData.name,
        email: updatedData.email,
        avatar: updatedData.avatar,
        token: newToken
      };
      return res.status(200).json(session);
    } else {
      // Normal update without username change
      const userRef = db.collection('users').doc(userId);
      await userRef.update(updates);
      
      const doc = await userRef.get();
      const user = doc.data();

      // Rotate session token
      await db.collection('sessions').doc(req.sessionToken).delete();
      const newToken = generateToken();
      await db.collection('sessions').doc(newToken).set({
        userId: doc.id,
        username: user.username,
        email: user.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const session = {
        id: doc.id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        token: newToken
      };
      res.status(200).json(session);
    }
  } catch (err) {
    console.error('Update Profile Error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.put('/api/auth/password', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { newPassword } = req.body;
  try {
    if (!db) throw new Error('Database not initialized');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    
    await db.collection('users').doc(userId).update({ passwordHash });
    res.status(200).json({ message: 'Password updated' });
  } catch (err) {
    console.error('Update Password Error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// User Data Sync (likes, dislikes, seen)
app.get('/api/user/data/:userId', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    if (!db) throw new Error('Database not initialized');
    const doc = await db.collection('userData').doc(userId).get();
    if (!doc.exists) {
      return res.status(200).json({ likes: [], dislikes: [], seen: [] });
    }
    res.status(200).json(doc.data());
  } catch (err) {
    console.error('Get User Data Error:', err);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

app.post('/api/user/data/:userId', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const updates = req.body;
  try {
    if (!db) throw new Error('Database not initialized');
    await db.collection('userData').doc(userId).set(updates, { merge: true });
    res.status(200).json({ message: 'Data synced' });
  } catch (err) {
    console.error('Sync Data Error:', err);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

// Logout (invalidate session)
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    if (db) {
      await db.collection('sessions').doc(req.sessionToken).delete();
    }
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
  app.get(/.*/, (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`🚀 Server listening at http://localhost:${port}`);
});
