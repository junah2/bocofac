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
