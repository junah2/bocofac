const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const BACKEND_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export function resolveImageUrl(path) {
  if (!path) return path;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return `${BACKEND_ORIGIN}${path}`;
}
