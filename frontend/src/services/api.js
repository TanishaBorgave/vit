import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gst_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('gst_token');
      localStorage.removeItem('gst_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Upload
export const uploadAPI = {
  upload: (formData) =>
    api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getAll: () => api.get('/upload'),
  delete: (id) => api.delete(`/upload/${id}`),
};

// Reconciliation
export const reconciliationAPI = {
  run: () => api.post('/reconciliation/run'),
  getResults: (params) => api.get('/reconciliation/results', { params }),
};

// Dashboard
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

// Party
export const partyAPI = {
  getAll: () => api.get('/party'),
  getDetail: (gstin) => api.get(`/party/${gstin}`),
};

// Issues
export const issueAPI = {
  getAll: (params) => api.get('/issues', { params }),
  getSummary: () => api.get('/issues/summary'),
  updateStatus: (id, data) => api.patch(`/issues/${id}/status`, data),
};

// Returns (Phase 2)
export const returnsAPI = {
  // PDF Invoice Upload
  uploadInvoices: (formData) =>
    api.post('/returns/upload-invoices', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getInvoices: (params) => api.get('/returns/invoices', { params }),
  updateInvoice: (id, data) => api.put(`/returns/invoice/${id}`, data),

  // Summary & Validation
  getSummary: (params) => api.get('/returns/summary', { params }),
  validate: (data) => api.post('/returns/validate', data),

  // Generation
  generateGSTR1: (data) => api.post('/returns/generate-gstr1', data),
  generateGSTR3B: (data) => api.post('/returns/generate-gstr3b', data),

  // Exports
  getExports: (params) => api.get('/returns/exports', { params }),
  getHistory: () => api.get('/returns/history'),
  downloadExport: (id) =>
    api.get(`/returns/export/${id}`, { responseType: 'blob' }),
  deleteExport: (id) => api.delete(`/returns/export/${id}`),
};

// Vendor Risk (Phase 3 — ML)
export const vendorRiskAPI = {
  runAnalysis: () => api.post('/vendor-risk/analyze'),
  getAll: (params) => api.get('/vendor-risk', { params }),
  getDashboardStats: () => api.get('/vendor-risk/dashboard/stats'),
  getVendorDetail: (gstin) => api.get(`/vendor-risk/${gstin}`),
};

export default api;
