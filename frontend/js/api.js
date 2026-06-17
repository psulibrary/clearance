const api = {
  base: () => (window.API_BASE || ''),

  token: () => localStorage.getItem('access_token'),

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token()) headers['Authorization'] = `Bearer ${this.token()}`;
    const res = await fetch(this.base() + '/api' + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = 'index.html';
      return;
    }
    const data = await res.json();
    if (!res.ok) return Promise.reject(data);
    return data;
  },

  login: (u, p) => api.request('POST', '/auth/login/', { username: u, password: p }),
  stats: () => api.request('GET', '/stats/'),
  branches: () => api.request('GET', '/branches/'),
  clients: (qs = '') => api.request('GET', `/clients/${qs}`),
  client: (id) => api.request('GET', `/clients/${id}/`),
  createClient: (data) => api.request('POST', '/clients/', data),
  decide: (id, decision, remarks) => api.request('POST', `/clients/${id}/decide/`, { decision, remarks }),
  addAccountability: (clientId, data) => api.request('POST', `/clients/${clientId}/accountabilities/`, data),
  resolve: (accId) => api.request('POST', `/accountabilities/${accId}/resolve/`),
  sendReminders: () => api.request('POST', '/send-reminders/'),
};
