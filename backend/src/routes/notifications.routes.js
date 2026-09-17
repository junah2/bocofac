const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function toClient(row) {
  return {
    id: row.id,
    message: row.message,
    type: row.type,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.user.sub]
  );
  res.json(rows.map(toClient));
}));

router.patch('/read-all', requireAuth, asyncHandler(async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [req.user.sub]);
  res.json({ ok: true });
}));

router.patch('/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
    [req.params.id, req.user.sub]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Notification not found.' });
  res.json(toClient(rows[0]));
}));

module.exports = router;
