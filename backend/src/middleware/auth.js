const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');

const COOKIE_NAME = '__session';
const ABSOLUTE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
// [AUTH] Session: auto-logout pag 30 mins walang ginagawa, max 7 days
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

// [AUTH] Gumagawa ng JWT token na ilalagay sa httpOnly cookie pag nag-login
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function setAuthCookie(res, payload, req) {
  const jti = crypto.randomUUID();
  const token = signToken({ ...payload, jti });
  await pool.query(
    `INSERT INTO sessions (id, user_id, absolute_expires_at, ip, user_agent)
     VALUES ($1, $2, now() + interval '7 days', $3, $4)`,
    [jti, payload.sub, req && req.ip, req && req.get('user-agent')]
  );

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

// [AUTH] Chine-check kung valid pa ang token at session (hindi expired / hindi naka-logout)
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
      if (session) await pool.query('DELETE FROM sessions WHERE id = $1', [payload.jti]);
      clearAuthCookie(res);
      return next();
    }

    await pool.query('UPDATE sessions SET last_activity_at = now() WHERE id = $1', [payload.jti]);
    req.user = payload;
  } catch (err) {
  }
  next();
}

// [AUTHORIZATION] Kailangan naka-login para ma-access ang route
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}

// [AUTHORIZATION] Role check: admin / board / customer lang ang pwede sa route depende sa nakalagay
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
