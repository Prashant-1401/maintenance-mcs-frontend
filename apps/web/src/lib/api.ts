import axios from 'axios';

// In development, use Vite's local proxy (/api).
// In production, use VITE_API_URL or fallback to Render.
const defaultBaseUrl = import.meta.env.DEV 
  ? '/api' 
  : (import.meta.env.VITE_API_URL || 'https://maintenance-mcs-1.onrender.com/api');

export const api = axios.create({
  baseURL: defaultBaseUrl,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Demo mode mock responses for static / offline preview
const MOCK_DATA: Record<string, unknown> = {
  '/kpi/dashboard': {
    mttrMinutes: 42,
    mtbfDaysOverall: 18.5,
    breakdownCount: 3,
    openOrdersCount: 12,
    pendingJobsCount: 5,
    costs: { totalSpareCost: 14200, totalLaborCost: 8900 },
    lines: [
      { lineId: 'LINE-1', name: 'Packaging Line 1', mttrMinutes: 35, mtbfDays: 14, breakdownCount: 2 },
      { lineId: 'LINE-2', name: 'Extrusion Line 2', mttrMinutes: 48, mtbfDays: 22, breakdownCount: 1 },
    ],
  },
  '/work-orders/open': [],
  '/breakdowns': [],
  '/pm-schedules': [],
  '/predictive-schedules': [],
  '/assets': [],
  '/users': [],
  '/roles': [],
  '/spare-parts': [],
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const token = localStorage.getItem('token');
    const isDemo = !token || token.startsWith('demo-token') || localStorage.getItem('is_demo_mode') === 'true';

    // In demo mode or if remote backend fails: serve mock data if available
    if (isDemo && config?.url) {
      for (const [endpoint, mock] of Object.entries(MOCK_DATA)) {
        if (config.url.includes(endpoint)) {
          return { data: mock, status: 200, statusText: 'OK (Demo Mock)', headers: {}, config };
        }
      }
      // Return safe empty array / object for unmatched demo endpoints instead of failing
      return { data: [], status: 200, statusText: 'OK (Demo Mock)', headers: {}, config };
    }

    // 401 handling for real accounts
    if (error.response?.status === 401 && !isDemo) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Use hash-friendly redirect
      if (!window.location.hash.includes('/login')) {
        window.location.hash = '#/login';
      }
      return Promise.reject(error);
    }

    // Auto-retry on cold-start 502/503/504
    if (
      config &&
      !config.__isRetry &&
      (error.code === 'ERR_NETWORK' ||
        error.code === 'ECONNABORTED' ||
        (error.response && [502, 503, 504].includes(error.response.status)))
    ) {
      config.__isRetry = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return api(config);
    }

    return Promise.reject(error);
  },
);
