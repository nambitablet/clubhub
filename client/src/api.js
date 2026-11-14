const KEY = 'clubhub.token';
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch {} };

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
// URL for downloads (CSV/PDF/ICS) that need auth via query token
export const fileUrl = (path, extra = '') => `/api${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(getToken() || '')}${extra}`;
export const qrUrl = (data) => `/api/qr?data=${encodeURIComponent(data)}`;
