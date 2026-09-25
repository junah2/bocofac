const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { nextMemberId } = require('../utils/ids');
const { broadcast } = require('../sse');
const { auditFromRequest } = require('../utils/audit');
const { notifyUser } = require('../utils/notify');
const {
  MIN_REQUIRED_SHARE_CAPITAL,
  MAX_REQUIRED_SHARE_CAPITAL,
  SHARE_CAPITAL_CAP,
  validateRequiredShareCapital,
} = require('../utils/shareCapital');

const router = express.Router();

const SHARE_CAPITAL_RANGE_ERROR = `Required share capital must be between ₱${MIN_REQUIRED_SHARE_CAPITAL.toLocaleString()} and ₱${MAX_REQUIRED_SHARE_CAPITAL.toLocaleString()}.`;

function toClient(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    requiredShareCapital: Number(row.required_share_capital),
    joinedDate: row.joined_date,
    status: row.status,
    // Member's Information Sheet fields (paper form) - blank until an admin
    // fills them in from the physical folder, see schema.sql.
    address: row.address,
    mobileNumber: row.mobile_number,
    ncfrsId: row.ncfrs_id,
    rsbsaId: row.rsbsa_id,
    membershipFee: row.membership_fee === null ? null : Number(row.membership_fee),
    membershipFeeDatePaid: row.membership_fee_date_paid,
    membershipFeeReference: row.membership_fee_reference,
    hasCv: row.has_cv,
    hasFarmPhoto: row.has_farm_photo,
    hasShareCert: row.has_share_cert,
    farmProfileNotes: row.farm_profile_notes,
    civicOrgAffiliation: row.civic_org_affiliation,
  };
}

// Fields editable via PATCH /:id, matching the paper "Member's Information
// Sheet" content that isn't set at creation time (see POST / below).
const SHEET_FIELDS = [
  ['address', 'address'],
  ['mobileNumber', 'mobile_number'],
  ['ncfrsId', 'ncfrs_id'],
  ['rsbsaId', 'rsbsa_id'],
  ['membershipFee', 'membership_fee'],
  ['membershipFeeDatePaid', 'membership_fee_date_paid'],
  ['membershipFeeReference', 'membership_fee_reference'],
  ['hasCv', 'has_cv'],
  ['hasFarmPhoto', 'has_farm_photo'],
  ['hasShareCert', 'has_share_cert'],
  ['farmProfileNotes', 'farm_profile_notes'],
  ['civicOrgAffiliation', 'civic_org_affiliation'],
  ['requiredShareCapital', 'required_share_capital'],
];

router.get('/', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM members ORDER BY joined_date');
  res.json(rows.map(toClient));
}));

// Real membership status + share-capital balance for the signed-in customer's
// own Dashboard, replacing the old hardcoded "No Active Membership" placeholder.
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  // Look up member_id fresh rather than trusting the JWT claim - a member
  // gets linked to a user asynchronously (Board approval, see
  // applicants.routes.js), so a session issued before that would otherwise
  // carry a stale/null memberId until the user signs out and back in.
  const userResult = await pool.query('SELECT member_id FROM users WHERE id = $1', [req.user.sub]);
  const memberId = userResult.rows[0] && userResult.rows[0].member_id;
  if (!memberId) {
    return res.json({ member: null });
  }
  const memberResult = await pool.query('SELECT * FROM members WHERE id = $1', [memberId]);
  const member = memberResult.rows[0];
  if (!member) return res.json({ member: null });

  const contribResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger WHERE member_id = $1 AND status = 'Verified'`,
    [member.id]
  );
  // Verified payments only count as share capital up to SHARE_CAPITAL_CAP -
  // anything paid in beyond that is the member's savings instead, not more
  // share capital (and doesn't accrue the monthly earnings rate either, see
  // withdrawals.routes.js).
  const rawTotalContribution = Number(contribResult.rows[0].total);
  const totalContribution = Math.min(rawTotalContribution, SHARE_CAPITAL_CAP);
  const savingsBalance = Math.max(rawTotalContribution - SHARE_CAPITAL_CAP, 0);
  const remainingBalance = Math.max(Number(member.required_share_capital) - totalContribution, 0);

  // Subscribed share / paid-up capital were captured on the approved
  // application, not on the member record itself - pull them from the
  // applicant row that produced this member.
  const applicantResult = await pool.query(
    `SELECT subscribed_share, paid_up_capital FROM applicants
     WHERE created_member_id = $1 AND status = 'Approved'
     ORDER BY reviewed_at DESC LIMIT 1`,
    [member.id]
  );
  const applicant = applicantResult.rows[0];

  res.json({
    member: toClient(member),
    totalContribution,
    savingsBalance,
    remainingBalance,
    subscribedShare: applicant && applicant.subscribed_share !== null ? Number(applicant.subscribed_share) : null,
    paidUpCapital: applicant && applicant.paid_up_capital !== null ? Number(applicant.paid_up_capital) : null,
  });
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, email, requiredShareCapital } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required.' });
  }

  const capital = requiredShareCapital === undefined || requiredShareCapital === null || requiredShareCapital === ''
    ? 10000
    : validateRequiredShareCapital(requiredShareCapital);
  if (capital === null) {
    return res.status(400).json({ error: SHARE_CAPITAL_RANGE_ERROR });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await nextMemberId(client);
    const { rows } = await client.query(
      `INSERT INTO members (id, name, email, required_share_capital, joined_date, status)
       VALUES ($1,$2,$3,$4,CURRENT_DATE,'Active')
       RETURNING *`,
      [id, name, email, capital]
    );
    await auditFromRequest(req, 'member.create', { db: client, entityType: 'member', entityId: id });
    await client.query('COMMIT');
    broadcast('members');
    res.status(201).json(toClient(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// Admin-only edit of the Member's Information Sheet fields (address, mobile,
// NCFRS/RSBSA IDs, membership fee filing, attached-copy checklist, farm
// profile notes, civic org affiliation) - a bounded field list rather than
// accepting an arbitrary body, so this can't be used to sneak a status/email
// change through a route that was only ever meant for sheet data.
router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  if (Object.prototype.hasOwnProperty.call(req.body, 'requiredShareCapital')) {
    const capital = validateRequiredShareCapital(req.body.requiredShareCapital);
    if (capital === null) {
      return res.status(400).json({ error: SHARE_CAPITAL_RANGE_ERROR });
    }
    req.body.requiredShareCapital = capital;
  }

  const sets = [];
  const values = [];
  for (const [clientKey, column] of SHEET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, clientKey)) {
      values.push(req.body[clientKey]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) {
    return res.status(400).json({ error: 'No recognized fields to update.' });
  }

  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE members SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!rows[0]) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  await auditFromRequest(req, 'member.update', { entityType: 'member', entityId: req.params.id });
  broadcast('members');
  res.json(toClient(rows[0]));
}));

// Lets admin/board nudge a Delinquent member before escalating to removal,
// instead of the only options being "do nothing" or "remove them" - sends an
// in-app notification to whichever account is linked to this member record.
router.patch('/:id/remind', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  const member = rows[0];
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  const { rows: userRows } = await pool.query('SELECT id FROM users WHERE member_id = $1', [member.id]);
  if (!userRows[0]) {
    return res.status(409).json({ error: 'This member has no linked account to notify.' });
  }

  await notifyUser(
    pool,
    userRows[0].id,
    'Reminder: Your BOCOFAC share capital account is marked Delinquent. Please settle your required contribution to remain in good standing.',
    'error'
  );
  await auditFromRequest(req, 'member.reminder_sent', { entityType: 'member', entityId: member.id });
  res.json({ ok: true });
}));

// Admin-only, same operational-management reasoning as PATCH /:id above.
// "Removed" is a soft status (the row, and every ledger/order/withdrawal
// record that references this member id, stays intact for history) - this
// does not delete anything or touch the linked user account.
router.patch('/:id/status', requireRole('admin'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['Active', 'Delinquent', 'Removed'].includes(status)) {
    return res.status(400).json({ error: "status must be 'Active', 'Delinquent', or 'Removed'." });
  }
  const { rows } = await pool.query(
    'UPDATE members SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Member not found.' });

  await auditFromRequest(req, 'member.status_changed', { entityType: 'member', entityId: rows[0].id, metadata: { status } });
  broadcast('members');
  res.json(toClient(rows[0]));
}));

module.exports = router;
