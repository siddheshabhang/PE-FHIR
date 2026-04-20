import api from './api';

// ─── Mock Data Fallback ──────────────────────────────────────────────────────
const MOCK_ENABLED = false;

const MOCK_LOGIN = {
  accessToken: 'mock-access-token-abc123',
  refreshToken: 'mock-refresh-token-xyz789',
  username: 'demo_user',
  role: 'DOCTOR',
};

export const authService = {
  login: async (username, password, role) => {
    try {
      const res = await api.post('/auth/login', { username, password });
      return res.data;
    } catch (err) {
      if (MOCK_ENABLED) {
        console.warn('[Mock] Login fallback active');
        return { ...MOCK_LOGIN, role: role || 'DOCTOR', username };
      }
      throw err;
    }
  },

  register: async (username, password, role, patientId) => {
    try {
      const res = await api.post('/auth/register', {
        username,
        password,
        role,
        ...(role === 'PATIENT' && patientId ? { patientId } : {}),
      });
      return res.data;
    } catch (err) {
      if (MOCK_ENABLED) {
        console.warn('[Mock] Register fallback active');
        return { message: 'User registered successfully', username, role };
      }
      throw err;
    }
  },

  refresh: async (refreshToken) => {
    const res = await api.post('/auth/refresh', { refreshToken });
    return res.data;
  },
};
