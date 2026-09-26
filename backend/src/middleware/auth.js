// 2-42 JWT for authentication and session management. The JWT is stored in an httpOnly cookie, and the server maintains a sessions table to enforce idle timeouts and allow revocation.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');

// auto logout 30 mins
// Must be exactly "__session": Firebase Hosting strips every other cookie
// before forwarding a request to a Cloud Function.
const COOKIE_NAME = '__session';
const ABSOLUTE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// Creates the JWT (carrying a fresh jti) and the server-side session row that
// jti points to. The row is what actually enforces the 30-minute idle
// timeout and makes logout/password-reset able to revoke a session - the JWT
// alone can only expire, never be revoked, once handed to the client.
async function setAuthCookie(res, payload, req) {
  const jti = crypto.randomUUID();
  const token = signToken({ ...payload, jti });
  await pool.query(
    `INSERT INTO sessions (id, user_id, absolute_expires_at, ip, user_agent)
     VALUES ($1, $2, now() + interval '7 days', $3, $4)`,
    [jti, payload.sub, req && req.ip, req && req.get('user-agent')]
  );
  // 'lax' only carries the cookie on same-site requests (fine for local dev,
  // where frontend and backend are just different localhost ports under the
  // same effective site). Once deployed, frontend and backend typically sit
  // on genuinely different domains, so the cookie must be 'none' to survive
  // the frontend's cross-origin fetch() calls - browsers require 'secure'
  // alongside 'none', which is exactly when COOKIE_SECURE is true anyway.

  // http only cookies 
  const secure = process.env.COOKIE_SECURE === 'true';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    maxAge: ABSOLUTE_SESSION_MS,
    path: '/',
  });
}

function clearAuthCookie(res) {
  // Must repeat the same sameSite/secure attributes used when the cookie was
  // set - browsers only accept a clearing Set-Cookie as a match for the
  // original if these line up, otherwise the cookie survives "logout".
  const secure = process.env.COOKIE_SECURE === 'true';
  res.clearCookie(COOKIE_NAME, { path: '/', sameSite: secure ? 'none' : 'lax', secure });
}

async function revokeSession(jti) {
  if (!jti) return;
  await pool.query('DELETE FROM sessions WHERE id = $1', [jti]);
}

async function revokeAllSessionsForUser(userId) {
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

// Populates req.user if a valid cookie AND a live, non-idle session are
// present, but does not reject the request otherwise - used for routes like
// POST /orders that work for both guests and signed-in customers.
async function attachUser(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT last_activity_at, absolute_expires_at FROM sessions WHERE id = $1 AND user_id = $2`,
      [payload.jti, payload.sub]
    );
    const session = rows[0];
    const idleExpired = session && Date.now() - new Date(session.last_activity_at).getTime() > IDLE_TIMEOUT_MS;
    const absoluteExpired = session && new Date(session.absolute_expires_at).getTime() < Date.now();

    if (!session || idleExpired || absoluteExpired) {
      // Session revoked, idle-timed-out, or past its absolute cap - clean up
      // the stale row (if any) and the cookie, and fall through as anonymous
      // rather than erroring, matching this middleware's non-rejecting contract.
      if (session) await pool.query('DELETE FROM sessions WHERE id = $1', [payload.jti]);
      clearAuthCookie(res);
      return next();
    }

    await pool.query('UPDATE sessions SET last_activity_at = now() WHERE id = $1', [payload.jti]);
    req.user = payload;
  } catch (err) {
    // Invalid/expired token - treat as anonymous rather than erroring.
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  setAuthCookie,
  clearAuthCookie,
  revokeSession,
  revokeAllSessionsForUser,
  attachUser,
  requireAuth,
  requireRole,
};
