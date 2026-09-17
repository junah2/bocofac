const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole, requireAuth } = require('../middleware/auth');
const { nextWithdrawalId } = require('../utils/ids');
const { broadcast } = require('../sse');
const { notifyByMemberId } = require('../utils/notify');
const { auditFromRequest } = require('../utils/audit');
const { SHARE_CAPITAL_CAP } = require('../utils/shareCapital');

const router = express.Router();

const MONTHLY_RATE = 0.10;

function toClient(row) {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name || undefined,
    requestedAmount: Number(row.requested_amount),
    status: row.status,
    requestedAt: row.requested_at,
    sentAmount: row.sent_amount !== null ? Number(row.sent_amount) : undefined,
    sentReference: row.sent_reference || undefined,
    note: row.note || undefined,
    processedByName: row.processed_by_name || undefined,
    processedAt: row.processed_at,
  };
}

// Whole calendar months elapsed since `joinedDate`, floored - a partial
// month in progress doesn't count yet, matching how the flat monthly-earning
// display on the dashboard only shows one month's worth at a time.
function monthsElapsed(joinedDate) {
  const start = new Date(joinedDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

// Earnings only ever accrue for members who have fully paid their required
// share capital (mirrors the "Fully Paid" badge elsewhere) - months are
// counted from `joined_date` since that's the only membership-start
// timestamp the schema tracks. Available balance nets out everything
// already sent so a member can never double-withdraw the same accrual.
async function getEarningsSummary(client, memberId) {
  const { rows } = await client.query(
    `SELECT m.required_share_capital, m.joined_date,
            COALESCE((SELECT SUM(amount) FROM ledger WHERE member_id = m.id AND status = 'Verified'), 0) AS total_contribution,
            COALESCE((SELECT SUM(sent_amount) FROM withdrawals WHERE member_id = m.id AND status = 'Sent'), 0) AS total_sent
     FROM members m WHERE m.id = $1`,
    [memberId]
  );
  const row = rows[0];
  if (!row) return { lifetimeAccrued: 0, totalSent: 0, availableBalance: 0 };

  // Same cap as members.routes.js GET /me: payments beyond SHARE_CAPITAL_CAP
  // are the member's savings, not more share capital, so they don't accrue
  // the monthly earnings rate either.
  const shareCapitalContribution = Math.min(Number(row.total_contribution), SHARE_CAPITAL_CAP);
  const isFullyPaid = Number(row.required_share_capital) > 0 && shareCapitalContribution >= Number(row.required_share_capital);
  const lifetimeAccrued = isFullyPaid ? shareCapitalContribution * MONTHLY_RATE * monthsElapsed(row.joined_date) : 0;
  const totalSent = Number(row.total_sent);
  const availableBalance = Math.max(0, lifetimeAccrued - totalSent);
  return { lifetimeAccrued, totalSent, availableBalance };
}

async function currentMemberId(req) {
  const { rows } = await pool.query('SELECT member_id FROM users WHERE id = $1', [req.user.sub]);
  return rows[0] && rows[0].member_id;
}

// Self-service: the signed-in customer's own accrued balance + request history.
router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const memberId = await currentMemberId(req);
  if (!memberId) return res.json({ availableBalance: 0, lifetimeAccrued: 0, totalSent: 0, requests: [] });

  const summary = await getEarningsSummary(pool, memberId);
  const { rows } = await pool.query(
    'SELECT * FROM withdrawals WHERE member_id = $1 ORDER BY requested_at DESC',
    [memberId]
  );
  res.json({ ...summary, requests: rows.map(toClient) });
}));

// Customer requests a cashout of their accrued earnings - recorded Pending,
// same maker-checker spirit as ledger payments: a real person (admin) has to
// actually send the money and record it before this counts as paid out.
router.post('/mine', requireAuth, asyncHandler(async (req, res) => {
  const memberId = await currentMemberId(req);
  if (!memberId) {
    return res.status(403).json({ error: 'No active membership linked to this account.' });
  }
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'A positive amount is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { availableBalance } = await getEarningsSummary(client, memberId);
    if (amount > availableBalance) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Amount exceeds your available balance of ₱${availableBalance.toLocaleString()}.` });
    }
    const id = await nextWithdrawalId(client);
    const { rows } = await client.query(
      `INSERT INTO withdrawals (id, member_id, requested_amount, status)
       VALUES ($1, $2, $3, 'Pending') RETURNING *`,
      [id, memberId, amount]
    );
    await client.query('COMMIT');
    broadcast('withdrawals');
    res.status(201).json(toClient(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// Admin/board visibility over every member's withdrawal requests.
router.get('/', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT w.*, m.name AS member_name, u.name AS processed_by_name FROM withdrawals w
     JOIN members m ON m.id = w.member_id
     LEFT JOIN users u ON u.id = w.processed_by
     ORDER BY w.requested_at DESC`
  );
  res.json(rows.map(toClient));
}));

// Admin marks a request Sent once they've actually transferred the money
// (GCash/bank, outside the system) - sentAmount is recorded independently of
// requestedAmount since what actually got sent is the source of truth.
router.patch('/:id/send', requireRole('admin'), asyncHandler(async (req, res) => {
  const sentAmount = Number(req.body.sentAmount);
  const { reference } = req.body;
  if (!sentAmount || sentAmount <= 0) {
    return res.status(400).json({ error: 'A positive sentAmount is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT status FROM withdrawals WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!existing[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal request not found.' });
    }
    if (existing[0].status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This request has already been processed.' });
    }
    const { rows } = await client.query(
      `UPDATE withdrawals SET status = 'Sent', sent_amount = $1, sent_reference = $2,
              processed_by = $3, processed_at = now()
       WHERE id = $4 RETURNING *`,
      [sentAmount, reference || null, req.user.sub, req.params.id]
    );
    await notifyByMemberId(
      client,
      rows[0].member_id,
      `Your withdrawal request ${rows[0].id} was sent: ₱${Number(sentAmount).toLocaleString()}${reference ? ` (Ref: ${reference})` : ''}.`,
      'success'
    );
    await auditFromRequest(req, 'withdrawal.send', {
      db: client, entityType: 'withdrawal', entityId: rows[0].id,
      metadata: { memberId: rows[0].member_id, sentAmount, reference: reference || null },
    });
    await client.query('COMMIT');
    broadcast('withdrawals');
    res.json(toClient(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.patch('/:id/reject', requireRole('admin'), asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT status FROM withdrawals WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!existing[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal request not found.' });
    }
    if (existing[0].status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This request has already been processed.' });
    }
    const { rows } = await client.query(
      `UPDATE withdrawals SET status = 'Rejected', note = $1, processed_by = $2, processed_at = now()
       WHERE id = $3 RETURNING *`,
      [req.body.note || null, req.user.sub, req.params.id]
    );
    await notifyByMemberId(
      client,
      rows[0].member_id,
      `Your withdrawal request ${rows[0].id} for ₱${Number(rows[0].requested_amount).toLocaleString()} was rejected.`,
      'error'
    );
    await auditFromRequest(req, 'withdrawal.reject', {
      db: client, entityType: 'withdrawal', entityId: rows[0].id,
      metadata: { memberId: rows[0].member_id, note: req.body.note || null },
    });
    await client.query('COMMIT');
    broadcast('withdrawals');
    res.json(toClient(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;
