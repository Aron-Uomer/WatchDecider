// Firebase Database via Express Backend

export const getAuthHeaders = () => {
  const session = getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  return headers;
};

export const checkUsername = async (username) => {
  const res = await fetch('/api/auth/check-username', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Username already exists. Please pick another.');
  }
};

export const signup = async (username, password, email, code, additionalInfo = {}) => {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email, code, ...additionalInfo })
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to sign up');
  }

  const session = await res.json();
  localStorage.setItem('watchDecider_session', JSON.stringify(session));
  return session;
};

export const authenticate = async (email, password) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Invalid email or password.');
  }

  const session = await res.json();
  localStorage.setItem('watchDecider_session', JSON.stringify(session));
  return session;
};

export const getSession = () => {
  const session = localStorage.getItem('watchDecider_session');
  return session ? JSON.parse(session) : null;
};

export const logout = async () => {
  const session = getSession();
  if (session?.token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        }
      });
    } catch (err) {
      // Server logout failed, still clear local session
      console.error('Server logout failed:', err);
    }
  }
  localStorage.removeItem('watchDecider_session');
};

export const updateProfile = async (userId, updates) => {
  const res = await fetch('/api/auth/profile', {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ updates })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update profile');
  }

  const newSession = await res.json();
  localStorage.setItem('watchDecider_session', JSON.stringify(newSession));
  return newSession;
};

export const updatePassword = async (userId, newPassword) => {
  const res = await fetch('/api/auth/password', {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ newPassword })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update password');
  }
};

export const forgotPassword = async (email) => {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to request reset');
  return data;
};

export const verifyResetCode = async (email, code) => {
  const res = await fetch('/api/auth/verify-reset-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to verify code');
  return data;
};

export const resetPassword = async (email, newPassword) => {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newPassword })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reset password');
  return data;
};
