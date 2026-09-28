const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole, requireAuth } = require('../middleware/auth');
const { nextLedgerId, nextOrNumber } = require('../utils/ids');
const { broadcast } = require('../sse');
const { notifyByMemberId } = require('../utils/notify');
const { auditFromRequest } = require('../utils/audit');

const router = express.Router();

function toClient(row) {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name || undefined,
    paymentDate: row.payment_date,
    amount: Number(row.amount),
    referenceId: row.reference_id,
    paymentMethod: row.payment_method,
    status: row.status,
    verifiedAt: row.verified_at,
    enteredBy: row.entered_by || undefined,
    enteredByName: row.entered_by_name || undefined,
    verifiedByName: row.verified_by_name || undefined,
    orNumber: row.or_number || undefined,
  };
}

async function currentMemberId(req) {
  const { rows } = await pool.query('SELECT member_id FROM users WHERE id = $1', [req.user.sub]);
  return rows[0] && rows[0].member_id;
}

router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const memberId = await currentMemberId(req);
  if (!memberId) return res.json([]);
  const { rows } = await pool.query(
    `SELECT l.*, u.name AS verified_by_name FROM ledger l
     LEFT JOIN users u ON u.id = l.verified_by
     WHERE l.member_id = $1 ORDER BY l.payment_date DESC`,
    [memberId]
  );
  res.json(rows.map(toClient));
}));

// [SHARE CAPITAL] Member nag-submit ng bayad - Pending muna hanggang ma-verify
router.post('/mine', requireAuth, asyncHandler(async (req, res) => {
  const memberId = await currentMemberId(req);
  if (!memberId) {
    return res.status(403).json({ error: 'No active membership linked to this account.' });
  }
  const { amount, referenceId, paymentMethod, paymentDate } = req.body;
  if (!amount || amount <= 0 || !paymentMethod) {
    return res.status(400).json({ error: 'A positive amount and paymentMethod are required.' });
  }

  const id = await nextLedgerId(pool);
  const { rows } = await pool.query(
    `INSERT INTO ledger (id, member_id, payment_date, amount, reference_id, payment_method, status, entered_by)
     VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6,'Pending',$7)
     RETURNING *`,
    [id, memberId, paymentDate || null, amount, referenceId || null, paymentMethod, req.user.sub]
  );
  broadcast('ledger');
  res.status(201).json(toClient(rows[0]));
}));

router.get('/', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { memberId } = req.query;
  const { rows } = await pool.query(
    `SELECT l.*, m.name AS member_name, u.name AS entered_by_name, v.name AS verified_by_name FROM ledger l
     JOIN members m ON m.id = l.member_id
     LEFT JOIN users u ON u.id = l.entered_by
     LEFT JOIN users v ON v.id = l.verified_by
     WHERE $1::text IS NULL OR l.member_id = $1
     ORDER BY l.payment_date DESC`,
    [memberId || null]
  );
  res.json(rows.map(toClient));
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { memberId, amount, referenceId, paymentMethod, paymentDate } = req.body;
  if (!memberId || !amount || amount <= 0 || !paymentMethod) {
    return res.status(400).json({ error: 'memberId, a positive amount, and paymentMethod are required.' });
  }
  // [SHARE CAPITAL] Over-the-Counter = verified agad; GCash = kailangan pang i-verify
  const isOverTheCounter = paymentMethod === 'Over-the-Counter';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const memberCheck = await client.query('SELECT id FROM members WHERE id = $1', [memberId]);
    if (!memberCheck.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Member not found.' });
    }
    const id = await nextLedgerId(client);
    const orNumber = isOverTheCounter ? await nextOrNumber(client) : null;
    const { rows } = await client.query(
      `INSERT INTO ledger (id, member_id, payment_date, amount, reference_id, payment_method, status, entered_by, verified_at, verified_by, or_number)
       VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        id, memberId, paymentDate || null, amount, referenceId || null, paymentMethod,
        isOverTheCounter ? 'Verified' : 'Pending',
        req.user.sub,
        isOverTheCounter ? new Date() : null,
        isOverTheCounter ? req.user.sub : null,
        orNumber,
      ]
    );
    if (isOverTheCounter) {
      await notifyByMemberId(
        client,
        memberId,
        `Your payment of ₱${Number(amount).toLocaleString()} was recorded (OR: ${orNumber}).`,
        'success'
      );
    }
    await client.query('COMMIT');
    broadcast('ledger');
    res.status(201).json(toClient(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.patch('/:id/verify', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT entered_by, or_number FROM ledger WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!existing[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ledger entry not found.' });
    }
    // [AUTHORIZATION] Maker-checker: ang nag-encode ng bayad ay hindi pwedeng siya rin ang mag-verify
    if (existing[0].entered_by === req.user.sub) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You cannot verify a payment you entered yourself - ask another admin or board member to verify it.' });
    }

    // [SHARE CAPITAL] Official Receipt number (OR-YYYY-NNNNNN) pag verified na
    const orNumber = existing[0].or_number || await nextOrNumber(client);
    const { rows } = await client.query(
      `UPDATE ledger SET status = 'Verified', verified_at = CURRENT_DATE, verified_by = $1, or_number = $2
       WHERE id = $3 RETURNING *`,
      [req.user.sub, orNumber, req.params.id]
    );
    await notifyByMemberId(
      client,
      rows[0].member_id,
      `Your payment of ₱${Number(rows[0].amount).toLocaleString()} was verified (OR: ${orNumber}).`,
      'success'
    );
    await auditFromRequest(req, 'ledger.verify', {
      db: client, entityType: 'ledger', entityId: rows[0].id,
      metadata: { memberId: rows[0].member_id, amount: Number(rows[0].amount), orNumber },
    });
    await client.query('COMMIT');
    broadcast('ledger');
    res.json(toClient(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;
