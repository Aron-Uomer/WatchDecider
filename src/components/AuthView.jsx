import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signup, authenticate, checkUsername, forgotPassword, verifyResetCode, resetPassword } from '../services/auth';
import { KeyRound, Mail, User, ArrowRight, Sparkles, AlertCircle, CheckCircle2, Eye, EyeOff, Undo2 } from 'lucide-react';

const AuthView = ({ onAuthSuccess, onCancel }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Signup specific info
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Verification Screen State
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [resetStep, setResetStep] = useState('request'); // request, verify, new_password 
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isForgotMode, setIsForgotMode] = useState(false);
  
  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setEmail('');
    setError('');
    setSuccess('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setVerificationCode(['', '', '', '', '', '']);
    setResetStep('request');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!isLogin && !isForgotMode && password !== confirmPassword) {
      setError('Passwords do not match. Please check again.');
      setLoading(false);
      return;
    }

    try {
      if (isForgotMode) {
         if (resetStep === 'request') {
            await forgotPassword(email);
            setVerifyingEmail(email);
            setIsVerifying(true);
            setResetStep('verify');
            setSuccess('Reset code sent!');
         } else if (resetStep === 'new_password') {
            if (password !== confirmPassword) {
              setError('Passwords do not match.');
              setLoading(false);
              return;
            }
            await resetPassword(verifyingEmail, password);
            setSuccess('Password updated! You can now login.');
            setTimeout(() => {
                setIsForgotMode(false);
                setIsVerifying(false);
                resetForm();
            }, 2000);
         }
      } else if (isLogin) {
        const session = await authenticate(email, password);
        setSuccess('Welcome back!');
        setTimeout(() => onAuthSuccess(session), 1000);
      } else {
        await checkUsername(username);
        
        // Trigger verification email via backend (DISABLED due to Render blocking SMTP ports)
        /*
        try {
          const response = await fetch('/api/send-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await response.json();
          
          if (!response.ok) throw new Error(data.error || 'Failed to send verification email');

          setVerifyingEmail(email);
          setIsVerifying(true);
        } catch (err) {
          console.error('Failed to send verification:', err);
          setError(err.message);
          setLoading(false);
          return;
        }
        */

        // BYPASS: Sign up immediately without email verification
        const additionalInfo = { name: fullName };
        const session = await signup(username, password, email, '123456', additionalInfo);
        
        setSuccess('Account created successfully!');
        setTimeout(() => {
          onAuthSuccess(session);
        }, 1500);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleVerifyCode = async (e) => {
    if (e) e.preventDefault();
    const code = verificationCode.join('');
    if (code.length < 6) return;

    setVerifyLoading(true);
    setError('');
    try {
      if (isForgotMode) {
        await verifyResetCode(verifyingEmail, code);
        setSuccess('Code verified! Please set your new password.');
        setIsVerifying(false);
        setResetStep('new_password');
        setVerificationCode(['', '', '', '', '', '']);
      } else {
        const additionalInfo = { name: fullName };
        const session = await signup(username, password, verifyingEmail, code, additionalInfo);
        
        setSuccess('Email verified! Redirecting...');
        setTimeout(() => {
          onAuthSuccess(session);
        }, 1500);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setError('');
    try {
      await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyingEmail })
      });
      setSuccess('New code sent to ' + verifyingEmail);
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError('Failed to resend code');
    }
  };

  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...verificationCode];
    newCode[index] = value.slice(-1);
    setVerificationCode(newCode);

    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`).focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      document.getElementById(`code-${index - 1}`).focus();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="glass p-8 rounded-3xl border border-indigo-500/10 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
        {/* Animated Background Gradient */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />

        <div className="relative z-10">
          <header className="text-center mb-8">
            <div className="w-16 h-16 premium-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
              {isLogin ? (
                isVerifying ? <Mail className="text-white" size={32} /> : <KeyRound className="text-white" size={32} />
              ) : <Sparkles className="text-white" size={32} />}
            </div>
            <h2 className="text-3xl font-black font-outfit mb-2">
              {isVerifying ? 'Verify Email' : (isForgotMode ? (resetStep === 'new_password' ? 'New Password' : 'Forgot Password') : (isLogin ? 'Welcome Back' : 'Join the decider'))}
            </h2>
            <p className="text-slate-400 text-sm">
              {isVerifying 
                ? `Enter the 6-digit code sent to ${verifyingEmail}` 
                : (isForgotMode 
                    ? (resetStep === 'new_password' ? 'Choose a strong new password.' : 'No worries, we will send you a reset code.') 
                    : (isLogin ? 'Decide your next favorite watch.' : 'Unlock your own personalized watchlist.'))}
            </p>
          </header>

          <form onSubmit={isVerifying ? handleVerifyCode : handleSubmit} className="space-y-4">
            {isVerifying ? (
              <div className="space-y-6">
                <div className="flex justify-between gap-2">
                  {verificationCode.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`code-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      className="w-full h-12 bg-slate-900/50 border border-slate-800 rounded-xl text-center text-xl font-bold text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    />
                  ))}
                </div>

                {isForgotMode && resetStep !== 'new_password' && (
                   <div className="space-y-4">
                     {/* No extra fields here, just the code input above */}
                   </div>
                )}
                
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-red-500/10 text-red-400 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle size={14} /> {error}
                    </motion.div>
                  )}
                  {success && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-green-500/10 text-green-400 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle2 size={14} /> {success}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={verifyLoading || verificationCode.some(d => !d)}
                  className="w-full py-4 premium-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all"
                >
                  {verifyLoading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm Code'}
                </button>

                <div className="text-center flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0}
                    className="text-sm text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get a code? Resend"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                        resetForm();
                        setIsVerifying(false);
                        setIsForgotMode(false);
                    }}
                    className="text-xs text-slate-500 hover:text-white flex items-center justify-center gap-1 transition-colors"
                  >
                    <Undo2 size={12} /> Back to Login
                  </button>
                </div>
              </div>
            ) : (
              <>
                {resetStep !== 'new_password' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Email</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="john@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none"
                      />
                    </div>
                  </div>
                )}

                {!isLogin && !isForgotMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Full Name</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                          <User size={18} />
                        </div>
                        <input
                          type="text"
                          required={!isLogin && !isForgotMode}
                          placeholder="John Doe"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Username</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                           <User size={18} />
                        </div>
                        <input
                          type="text"
                          required={!isLogin && !isForgotMode}
                          placeholder="decider_fan"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {(!isForgotMode || resetStep === 'new_password') && (
                  <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                    {isForgotMode ? 'New Password' : 'Password'}
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                       <KeyRound size={18} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-12 text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {isLogin && (
                      <div className="text-right">
                          <button 
                              type="button"
                              onClick={() => {
                                  resetForm();
                                  setIsForgotMode(true);
                              }}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest"
                          >
                              Forgot Password?
                          </button>
                      </div>
                  )}
                </div>
                )}

                {isForgotMode && resetStep === 'new_password' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5"
                  >
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Confirm New Password</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        <KeyRound size={18} />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-12 text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </motion.div>
                )}

                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5"
                  >
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Confirm Password</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        <KeyRound size={18} />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required={!isLogin}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-12 text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </motion.div>
                )}

                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2"
                    >
                      <AlertCircle size={14} /> {error}
                    </motion.div>
                  )}
                  {success && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs flex items-center gap-2"
                    >
                      <CheckCircle2 size={14} /> {success}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 premium-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {isForgotMode ? (resetStep === 'new_password' ? 'Update Password' : 'Send Reset Code') : (isLogin ? 'Login to Portal' : 'Create Account')}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </>
            )}
          </form>

          {!isVerifying && (
            <footer className="mt-8 pt-6 border-t border-slate-800 flex flex-col gap-4 text-center">
              {isForgotMode ? (
                 <button 
                  onClick={() => {
                    resetForm();
                    setIsForgotMode(false);
                  }}
                  className="text-slate-400 text-sm hover:text-white transition-colors flex items-center justify-center gap-2"
                 >
                   <Undo2 size={16} /> Back to Login
                 </button>
              ) : (
                <button 
                  onClick={() => {
                    resetForm();
                    setIsLogin(!isLogin);
                    // Scroll to top for a clean start
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } }
                  className="text-slate-400 text-sm hover:text-white transition-colors"
                >
                    {isLogin ? "New here? Create an account instead." : "Already have an account? Login here."}
                </button>
              )}
              <button 
                  onClick={onCancel}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-widest font-black"
              >
                  Back to Discovery
              </button>
            </footer>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AuthView;
