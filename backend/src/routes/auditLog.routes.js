const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const MAX_PAGE_SIZE = 100;

function toClient(row) {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    actorRole: row.actor_role,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    ip: row.ip,
    userAgent: row.user_agent,
    metadata: row.metadata,
    outcome: row.outcome,
  };
}

// Admin-only per the cooperative's decision to keep this view narrower than
// the other admin/board-shared management endpoints (members, ledger verify).
router.get('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
  const offset = (page - 1) * pageSize;

  const conditions = [];
  const params = [];

  if (req.query.action) {
    params.push(req.query.action);
    conditions.push(`action = $${params.length}`);
  }
  if (req.query.actorUserId) {
    params.push(req.query.actorUserId);
    conditions.push(`actor_user_id = $${params.length}`);
  }
  if (req.query.from) {
    params.push(req.query.from);
    conditions.push(`occurred_at >= $${params.length}`);
  }
  if (req.query.to) {
    params.push(req.query.to);
    conditions.push(`occurred_at <= $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT count(*)::int AS total FROM audit_log ${where}`, params);
  const { rows } = await pool.query(
    `SELECT audit_log.*, users.name AS actor_name
     FROM audit_log
     LEFT JOIN users ON users.id = audit_log.actor_user_id
     ${where}
     ORDER BY occurred_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset]
  );

  res.json({
    entries: rows.map(toClient),
    page,
    pageSize,
    total: countResult.rows[0].total,
  });
}));

module.exports = router;
