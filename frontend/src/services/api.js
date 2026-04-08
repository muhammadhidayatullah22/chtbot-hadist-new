import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// JWT interceptor — attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 (expired token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// --- Chat ---
export const chatAPI = {
  getSessions: () => api.get('/chat/sessions'),
  getMessages: (sessionId) => api.get(`/chat/sessions/${sessionId}`),
  deleteSession: (sessionId) => api.delete(`/chat/sessions/${sessionId}`),

  // SSE streaming chat
  sendMessage: async (message, sessionId, onChunk, onSources, onDone, onError) => {
    const token = localStorage.getItem('token');
    const body = JSON.stringify({ message, session_id: sessionId });

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Server error' }));
        onError?.(err.detail || 'Gagal mengirim pesan');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content') {
                onChunk?.(data.data);
              } else if (data.type === 'sources') {
                onSources?.(data.data);
              } else if (data.type === 'done') {
                onDone?.(data.session_id);
              } else if (data.type === 'error') {
                onError?.(data.data);
              }
            } catch {
              // skip invalid JSON lines
            }
          }
        }
      }
    } catch (err) {
      onError?.(err.message || 'Network error');
    }
  },
};

// --- Admin ---
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getFiles: () => api.get('/admin/files'),
  deleteFile: (fileId) => api.delete(`/admin/files/${fileId}`),

  uploadFile: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });
  },
};

export default api;
