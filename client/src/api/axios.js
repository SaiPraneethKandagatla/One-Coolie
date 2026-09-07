import axios from 'axios';

// Centralized API Base URL resolution (Phase 7):
// - If VITE_API_URL is explicitly set, use it across all environments.
// - In development fallback: use '/api' to cleanly leverage Vite's reverse proxy to localhost:5000.
// - In production fallback: use production cloud backend URL.
const resolvedBaseUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : 'https://onecoolie.onrender.com/api');

const instance = axios.create({
  baseURL: resolvedBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to reliably retrieve JWT token from any storage key/container
export const getStoredToken = () => {
  try {
    let token = localStorage.getItem('token');
    if (token && typeof token === 'string' && token !== 'undefined' && token !== 'null') {
      return token.replace(/^"(.*)"$/, '$1').trim();
    }

    const userRaw = localStorage.getItem('userInfo');
    if (userRaw) {
      const parsed = JSON.parse(userRaw);
      const uToken = parsed?.token || parsed?.accessToken;
      if (uToken && typeof uToken === 'string' && uToken !== 'undefined' && uToken !== 'null') {
        const clean = uToken.replace(/^"(.*)"$/, '$1').trim();
        localStorage.setItem('token', clean);
        return clean;
      }
    }

    let sToken = sessionStorage.getItem('token');
    if (sToken && typeof sToken === 'string' && sToken !== 'undefined' && sToken !== 'null') {
      return sToken.replace(/^"(.*)"$/, '$1').trim();
    }

    const sUserRaw = sessionStorage.getItem('userInfo');
    if (sUserRaw) {
      const parsed = JSON.parse(sUserRaw);
      const suToken = parsed?.token || parsed?.accessToken;
      if (suToken && typeof suToken === 'string' && suToken !== 'undefined' && suToken !== 'null') {
        return suToken.replace(/^"(.*)"$/, '$1').trim();
      }
    }
  } catch (e) {
    console.error('Error resolving stored token:', e);
  }
  return null;
};

// ======================================
// ADD JWT TOKEN TO EVERY REQUEST
// ======================================
instance.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ======================================
// HANDLE EXPIRED / INVALID SESSIONS
// ======================================
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const msg = error.response.data?.message || '';
      // Only clear storage if backend explicitly confirms the token was verified and failed/expired
      if (/token failed|jwt expired|invalid token|session expired/i.test(msg)) {
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
      }
    }
    return Promise.reject(error);
  }
);

export default instance;