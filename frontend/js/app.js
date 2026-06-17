// Auth guard — redirect to login if no token
(function () {
  const page = location.pathname.split('/').pop();
  if (page !== 'index.html' && page !== '') {
    if (!localStorage.getItem('access_token')) {
      window.location.href = 'index.html';
    }
  }
})();

function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

function statusBadge(status) {
  const map = { pending: 'warning text-dark', cleared: 'success', rejected: 'danger' };
  return `<span class="badge bg-${map[status] || 'secondary'}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
