// `db` is either the shared pool or a transaction client - callers already
// inside a transaction (e.g. approving an applicant) pass their `client` so
// the audit row commits/rolls back atomically with the action it records.
// A failure here must never break the action being audited, so every call
// site is expected to wrap this in a way that a rejection doesn't abort the
// caller's own flow (this function itself swallows and logs its own errors).
async function logAudit(db, {
  actorUserId = null,
  actorEmail = null,
  actorRole = null,
  action,
  entityType = null,
  entityId = null,
  ip = null,
  userAgent = null,
  metadata = null,
  outcome = 'success',
}) {
  try {
    await db.query(
      `INSERT INTO audit_log
         (actor_user_id, actor_email, actor_role, action, entity_type, entity_id, ip, user_agent, metadata, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        actorUserId, actorEmail, actorRole, action, entityType, entityId,
        ip, userAgent, metadata ? JSON.stringify(metadata) : null, outcome,
      ]
    );
  } catch (err) {
    console.error('Failed to write audit log entry:', err.message);
  }
}

// Convenience for the common case of auditing an authenticated request
// against `req.user`, so route handlers don't repeat the same field mapping.
// req.user's JWT payload only carries sub/role/memberId (no email) - pass
// `actorEmail` explicitly via `extra` for events where it matters (e.g.
// pre-auth events keyed by email instead of a user id).
function auditFromRequest(req, action, extra = {}) {
  const { db, ...rest } = extra;
  return logAudit(db || require('../db/pool'), {
    actorUserId: req.user ? req.user.sub : null,
    actorRole: req.user ? req.user.role : null,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    action,
    ...rest,
  });
}

module.exports = { logAudit, auditFromRequest };
