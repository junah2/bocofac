const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

let handlers = [];
let patched = false;

// [AUTH] Kapag 401 ang sagot ng API (expired session), auto-logout ang user
function patchFetchOnce() {
  if (patched) return;
  patched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : input && input.url;
    if (response.status === 401 && url && url.startsWith(API_BASE)) {
      handlers.forEach((handler) => handler());
    }
    return response;
  };
}

export function registerUnauthorizedHandler(handler) {
  patchFetchOnce();
  handlers.push(handler);
  return () => {
    handlers = handlers.filter((h) => h !== handler);
  };
}
