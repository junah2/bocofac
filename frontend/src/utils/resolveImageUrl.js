const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const BACKEND_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

// Product photos uploaded via the admin form are stored as backend-relative
// paths (e.g. "/uploads/products/xxx.jpg"). An <img> pointed at that path
// directly would request it from whatever origin the page is served from -
// the CRA dev server on :3000, not the API on :4000 - and silently get back
// its SPA index.html fallback instead of the file. Resolve relative paths
// against the API's own origin; absolute URLs (external stock photos,
// data: URIs) pass through untouched.
export function resolveImageUrl(path) {
  if (!path) return path;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return `${BACKEND_ORIGIN}${path}`;
}
