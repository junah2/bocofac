import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll'];

// Client-side mirror of the backend's 30-minute idle timeout (see
// sessions.last_activity_at in middleware/auth.js) - the server is the real
// enforcement point (it'll reject the cookie once idle regardless of what
// the client does), but without this the tab just sits on stale dashboard
// state showing no sign the session died until the next failed request.
export default function useIdleTimeout({ active, timeoutMs, onIdle }) {
  const timerRef = useRef(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!active) return undefined;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [active, timeoutMs]);
}
