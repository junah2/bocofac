const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

let handlers = [];
let patched = false;

// Deliberate scope-minimizing tradeoff: there are ~56 raw fetch() call sites
// across the frontend (App.jsx, MembershipPortal.jsx, the dashboard pages),
// each repeating `credentials: 'include'` ad hoc. Migrating all of them to a
// shared apiFetch() wrapper would be the cleaner long-term fix, but that's a
// much larger, regression-risky diff for what's meant to be a security-
// hardening pass, not a refactor. Wrapping the global fetch once here lets
// every existing call site pick up "session died server-side -> force
// logout" behavior with zero changes to those call sites. A real apiFetch()
// wrapper is a reasonable follow-up, not part of this change.
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

// Registers a callback fired whenever any request to this app's API returns
// 401. Returns an unregister function, meant to be used from a useEffect.
export function registerUnauthorizedHandler(handler) {
  patchFetchOnce();
  handlers.push(handler);
  return () => {
    handlers = handlers.filter((h) => h !== handler);
  };
}
