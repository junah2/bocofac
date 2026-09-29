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

// [EARNINGS] 10% kada buwan ng share capital (fully paid members lang)
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

// [EARNINGS] Bilang ng buong buwan mula nang sumali ang member
function monthsElapsed(joinedDate) {
  const start = new Date(joinedDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

async function getEarningsSummary(client, memberId) {
  const { rows } = await client.query(
    `SELECT m.required_share_capital, m.joined_date,
            COALESCE((SELECT SUM(amount) FROM ledger WHERE member_id = m.id AND status = 'Verified'), 0) AS total_contribution,
            COALESCE((SELECT SUM(sent_amount) FROM withdrawals WHERE member_id = m.id AND status = 'Sent'), 0) AS total_sent,
            COALESCE((SELECT SUM(requested_amount) FROM withdrawals WHERE member_id = m.id AND status IN ('Pending', 'Approved')), 0) AS total_in_progress
     FROM members m WHERE m.id = $1`,
    [memberId]
  );
  const row = rows[0];
  if (!row) return { lifetimeAccrued: 0, totalSent: 0, availableBalance: 0 };

  const shareCapitalContribution = Math.min(Number(row.total_contribution), SHARE_CAPITAL_CAP);
  const isFullyPaid = Number(row.required_share_capital) > 0 && shareCapitalContribution >= Number(row.required_share_capital);
  // [EARNINGS] Lifetime Earnings = Share Capital x 10% x Months Earned
  // Kasama na ang kasalukuyang buwan: kapag fully paid, may ma-wi-withdraw na agad (1 buwan na kita)
  const monthsEarned = monthsElapsed(row.joined_date) + 1;
  const lifetimeAccrued = isFullyPaid ? shareCapitalContribution * MONTHLY_RATE * monthsEarned : 0;
  const totalSent = Number(row.total_sent);
  const totalInProgress = Number(row.total_in_progress);
  // [EARNINGS] Available Balance = Lifetime Earnings - Nai-release na - Naka-request pa (pending/approved)
  const availableBalance = Math.max(0, lifetimeAccrued - totalSent - totalInProgress);
  return { lifetimeAccrued, totalSent, totalInProgress, availableBalance };
}

async function currentMemberId(req) {
  const { rows } = await pool.query('SELECT member_id FROM users WHERE id = $1', [req.user.sub]);
  return rows[0] && rows[0].member_id;
}

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
    await client.query('SELECT id FROM members WHERE id = $1 FOR UPDATE', [memberId]);
    // [VALIDATION] Isang active na request lang (pending o approved) bawat member
    const { rows: active } = await client.query(
      "SELECT id FROM withdrawals WHERE member_id = $1 AND status IN ('Pending', 'Approved') LIMIT 1",
      [memberId]
    );
    if (active[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `You still have a withdrawal request in progress (${active[0].id}). Please wait until it is released or rejected.` });
    }
    const { availableBalance } = await getEarningsSummary(client, memberId);
    // [VALIDATION] Bawal mag-withdraw nang higit sa available balance
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

router.get('/', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT w.*, m.name AS member_name, u.name AS processed_by_name FROM withdrawals w
     JOIN members m ON m.id = w.member_id
     LEFT JOIN users u ON u.id = w.processed_by
     ORDER BY w.requested_at DESC`
  );
  res.json(rows.map(toClient));
}));

// [EARNINGS] Admin: i-approve ang request; ang member ay pupunta sa office para i-claim ang cash
router.patch('/:id/approve', requireRole('admin'), asyncHandler(async (req, res) => {
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
      return res.status(400).json({ error: 'Only pending requests can be approved.' });
    }
    const { rows } = await client.query(
      "UPDATE withdrawals SET status = 'Approved' WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    await notifyByMemberId(
      client,
      rows[0].member_id,
      `Your withdrawal request ${rows[0].id} for ₱${Number(rows[0].requested_amount).toLocaleString()} was approved. Please claim the cash at the BOCOFAC office.`,
      'success'
    );
    await auditFromRequest(req, 'withdrawal.approve', {
      db: client, entityType: 'withdrawal', entityId: rows[0].id,
      metadata: { memberId: rows[0].member_id },
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
    if (!['Pending', 'Approved'].includes(existing[0].status)) {
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
      `Your withdrawal request ${rows[0].id} was released: ₱${Number(sentAmount).toLocaleString()} received at the BOCOFAC office${reference ? ` (Ref: ${reference})` : ''}.`,
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
    if (!['Pending', 'Approved'].includes(existing[0].status)) {
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
      `Your withdrawal request ${rows[0].id} for ₱${Number(rows[0].requested_amount).toLocaleString()} was rejected.${req.body.note ? ` Reason: ${req.body.note}` : ''}`,
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
