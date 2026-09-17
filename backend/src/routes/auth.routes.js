const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const {
  COOKIE_NAME, setAuthCookie, clearAuthCookie, requireAuth,
  revokeSession, revokeAllSessionsForUser,
} = require('../middleware/auth');
const { sendPasswordResetCodeEmail } = require('../utils/mailer');
const { logAudit, auditFromRequest } = require('../utils/audit');
const { validate } = require('../middleware/validate');
const { signupSchema, signinSchema, updateMeSchema, passwordSchema } = require('../validation/auth.schema');
const { signinLimiter, signupLimiter, forgotPasswordLimiter, resetPasswordLimiter } = require('../middleware/rateLimit');
const { uploadAvatar, verifyUploadedFileType, IMAGE_MIME_TYPES } = require('../middleware/upload');

const BCRYPT_ROUNDS = 12;
const router = express.Router();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.post('/signup', signupLimiter, validate(signupSchema), asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Link to an existing Member/shareholder record by email match, if one exists.
  const memberMatch = await pool.query(
    'SELECT id FROM members WHERE lower(email) = lower($1)',
    [email]
  );
  const memberId = memberMatch.rows[0] ? memberMatch.rows[0].id : null;

  const { rows } = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash, role, member_id)
     VALUES ($1,$2,$3,$4,'customer',$5)
     RETURNING id, name, email, phone, role, member_id AS "memberId", created_at AS "createdAt"`,
    [name, email, phone || null, passwordHash, memberId]
  );

  const user = rows[0];
  await setAuthCookie(res, { sub: user.id, role: user.role, memberId: user.memberId }, req);
  await logAudit(pool, {
    actorUserId: user.id, actorEmail: user.email, actorRole: user.role,
    action: 'auth.signup', entityType: 'user', entityId: String(user.id),
    ip: req.ip, userAgent: req.get('user-agent'),
  });
  res.status(201).json(user);
}));

router.post('/signin', signinLimiter, validate(signinSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // CHECKS USERS CREDENTIALS and password
  const { rows } = await pool.query(
    `SELECT id, name, email, phone, role, password_hash AS "passwordHash", member_id AS "memberId", avatar_url AS "avatarUrl", created_at AS "createdAt"
     FROM users WHERE email = $1`,
    [email]
  );
  const user = rows[0];
  const valid = user && (await bcrypt.compare(password, user.passwordHash));

  if (!valid) {
    await logAudit(pool, {
      actorEmail: email, action: 'auth.signin', entityType: 'user',
      ip: req.ip, userAgent: req.get('user-agent'), outcome: 'failure',
    });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  await setAuthCookie(res, { sub: user.id, role: user.role, memberId: user.memberId }, req);
  await logAudit(pool, {
    actorUserId: user.id, actorEmail: user.email, actorRole: user.role,
    action: 'auth.signin', entityType: 'user', entityId: String(user.id),
    ip: req.ip, userAgent: req.get('user-agent'),
  });
  delete user.passwordHash;
  res.json(user);
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      await revokeSession(payload.jti);
      await logAudit(pool, {
        actorUserId: payload.sub, actorRole: payload.role, action: 'auth.logout',
        entityType: 'user', entityId: String(payload.sub),
        ip: req.ip, userAgent: req.get('user-agent'),
      });
    } catch (err) {
      // Invalid/expired token - nothing to revoke, just clear the cookie below.
    }
  }
  clearAuthCookie(res);
  res.status(204).end();
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, email, phone, role, member_id AS "memberId", avatar_url AS "avatarUrl", created_at AS "createdAt" FROM users WHERE id = $1`,
    [req.user.sub]
  );
  if (!rows[0]) return res.status(401).json({ error: 'Authentication required.' });
  res.json(rows[0]);
}));

router.patch('/me', requireAuth, validate(updateMeSchema), asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET name = $1, email = $2, phone = $3, updated_at = now()
       WHERE id = $4
       RETURNING id, name, email, phone, role, member_id AS "memberId", avatar_url AS "avatarUrl", created_at AS "createdAt"`,
      [name, email, phone || null, req.user.sub]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    throw err;
  }
}));

// Split out from PATCH /me (JSON body) since this one is multipart/form-data
// and swaps the file the moment it's picked, independent of the rest of the
// profile form/its Save Changes click.
router.patch('/me/avatar', requireAuth, uploadAvatar.single('avatar'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'An image file is required.' });
  }
  if (!(await verifyUploadedFileType(req.file.path, IMAGE_MIME_TYPES))) {
    return res.status(400).json({ error: 'Image file content does not match an allowed type (JPG/PNG/WebP).' });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const { rows } = await pool.query(
    `UPDATE users SET avatar_url = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, name, email, phone, role, member_id AS "memberId", avatar_url AS "avatarUrl", created_at AS "createdAt"`,
    [avatarUrl, req.user.sub]
  );
  await auditFromRequest(req, 'user.avatar_update', { entityType: 'user', entityId: String(req.user.sub) });
  res.json(rows[0]);
}));

// Change password while signed in - distinct from /forgot-password +
// /reset-password (the token-via-email flow for a customer who's locked
// out). This one requires knowing the current password, so it doesn't need
// a reset token or session revocation.
router.patch('/me/password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
  }
  const passwordCheck = passwordSchema.safeParse(newPassword);
  if (!passwordCheck.success) {
    return res.status(400).json({ error: passwordCheck.error.issues[0].message });
  }

  const { rows } = await pool.query('SELECT password_hash AS "passwordHash" FROM users WHERE id = $1', [req.user.sub]);
  if (!rows[0]) return res.status(401).json({ error: 'Authentication required.' });

  const valid = await bcrypt.compare(currentPassword, rows[0].passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, req.user.sub]);
  await auditFromRequest(req, 'user.password_change', { entityType: 'user', entityId: String(req.user.sub) });
  res.json({ message: 'Password updated successfully.' });
}));

router.post('/forgot-password', forgotPasswordLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (rows[0]) {
    // 6-digit code instead of a link token - the customer types this back
    // into the app themselves, so it needs to stay short/typeable. Padded
    // so a code like "004821" keeps its full 10^6 keyspace (no leading-zero
    // codes silently becoming 5-digit).
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = hashToken(code);
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(
      'UPDATE users SET password_reset_token_hash = $1, password_reset_expires = $2 WHERE id = $3',
      [codeHash, expires, rows[0].id]
    );
    // Fire-and-forget on purpose - awaiting this (or letting a failure
    // change the response) would leak whether the address exists via
    // response timing/content. Both outcomes are logged so a delivery
    // failure is still visible to whoever is watching the server console.
    sendPasswordResetCodeEmail(email, code)
      .then(() => console.log(`Password reset code sent to ${email}`))
      .catch((err) => {
        console.error('Failed to send password reset code:', err.message);
      });
    await logAudit(pool, {
      actorUserId: rows[0].id, actorEmail: email, action: 'auth.password_reset.requested',
      entityType: 'user', entityId: String(rows[0].id), ip: req.ip, userAgent: req.get('user-agent'),
    });
  }

  // Same response whether or not the email matched, so this endpoint can't
  // be used to probe which addresses have accounts.
  res.json({ message: 'If an account exists for that email, a reset code has been sent.' });
}));

router.post('/reset-password', resetPasswordLimiter, asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, code, and new password are required.' });
  }
  const passwordCheck = passwordSchema.safeParse(newPassword);
  if (!passwordCheck.success) {
    return res.status(400).json({ error: passwordCheck.error.issues[0].message });
  }

  const codeHash = hashToken(code);
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND password_reset_token_hash = $2 AND password_reset_expires > now()',
    [email, codeHash]
  );
  if (!rows[0]) {
    return res.status(400).json({ error: 'This code is invalid or has expired.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await pool.query(
    `UPDATE users SET password_hash = $1, password_reset_token_hash = NULL, password_reset_expires = NULL
     WHERE id = $2`,
    [passwordHash, rows[0].id]
  );
  // A password reset should invalidate any existing sessions for the account
  // (e.g. if the reset was triggered because the account was compromised).
  await revokeAllSessionsForUser(rows[0].id);
  await logAudit(pool, {
    actorUserId: rows[0].id, action: 'auth.password_reset.completed',
    entityType: 'user', entityId: String(rows[0].id), ip: req.ip, userAgent: req.get('user-agent'),
  });
  res.json({ message: 'Password updated successfully.' });
}));

module.exports = router;
