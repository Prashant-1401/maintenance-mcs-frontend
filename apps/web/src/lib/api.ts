import axios from 'axios';

// In development, use Vite's local proxy (/api) to avoid CORS & cold start delays.
// In production, use VITE_API_URL or fallback to relative /api.
const defaultBaseUrl = import.meta.env.DEV 
  ? '/api' 
  : (import.meta.env.VITE_API_URL || 'https://maintenance-mcs-1.onrender.com/api');

export const api = axios.create({
  baseURL: defaultBaseUrl,
  timeout: 45000, // 45s timeout for cold starts on Render free tier
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Exponential retry on network error or server cold start 502/503/504
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Auto-retry on 502, 503, 504 or Network Error (cold-start recovery)
    if (
      config &&
      !config.__isRetry &&
      (error.code === 'ERR_NETWORK' ||
        error.code === 'ECONNABORTED' ||
        (error.response && [502, 503, 504].includes(error.response.status)))
    ) {
      config.__isRetry = true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return api(config);
    }

    return Promise.reject(error);
  },
);
