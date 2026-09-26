const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { nextSessionId } = require('../utils/ids');
const { broadcast } = require('../sse');
const { auditFromRequest } = require('../utils/audit');
const { generatePmesCertificatePdf } = require('../utils/pmesCertificate');
const { sendPmesCertificateEmail } = require('../utils/mailer');
const { applicantLookupLimiter } = require('../middleware/rateLimit');

const router = express.Router();

function toClient(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time_range,
    venue: row.venue,
    speaker: row.speaker,
    registeredCount: Number(row.registered_count),
    status: row.status,
    capacity: row.capacity,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, COUNT(r.id) AS registered_count
     FROM pmes_sessions s
     LEFT JOIN pmes_registrations r ON r.session_id = s.id
     GROUP BY s.id
     ORDER BY s.date`
  );
  res.json(rows.map(toClient));
}));

// Lets a guest with no applicant/member record yet find out whether they're
// already recognized as having attended a PMES seminar (walked in and were
// checked in present at the venue), so the Membership page can gate/ungate
// "Apply for Membership" for someone who hasn't filed an application at all
// - the same email match used by POST /applicants to auto-link a walk-in.
router.get('/attendance-check/:email', applicantLookupLimiter, asyncHandler(async (req, res) => {
  const email = req.params.email.trim().toLowerCase();
  const walkIn = await pool.query(
    `SELECT 1 FROM pmes_registrations WHERE lower(walk_in_email) = $1 AND attended = true LIMIT 1`,
    [email]
  );
  if (walkIn.rows[0]) return res.json({ attended: true });

  const applicant = await pool.query(
    `SELECT pmes_attended FROM applicants WHERE lower(email) = $1 ORDER BY submitted_at DESC LIMIT 1`,
    [email]
  );
  res.json({ attended: !!applicant.rows[0]?.pmes_attended });
}));

// Lets the Membership page and client dashboard show "you're already
// registered for X" persistently, instead of only in a one-time toast/modal
// right after clicking Reserve Slot - covers all three ways a registration
// can be linked (applicant, member, or a walk-in/self-registered account
// email), same matching logic /:id/register itself uses to attach one.
router.get('/my-registration/:email', applicantLookupLimiter, asyncHandler(async (req, res) => {
  const email = req.params.email.trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.date, s.time_range AS time, s.venue, s.speaker, r.attended
     FROM pmes_registrations r
     JOIN pmes_sessions s ON s.id = r.session_id
     LEFT JOIN applicants a ON a.id = r.applicant_id
     LEFT JOIN members m ON m.id = r.member_id
     WHERE lower(COALESCE(a.email, m.email, r.walk_in_email)) = $1
     ORDER BY r.registered_at DESC
     LIMIT 1`,
    [email]
  );
  if (!rows[0]) return res.json({ registered: false });
  const row = rows[0];
  res.json({
    registered: true,
    attended: row.attended,
    session: { id: row.id, title: row.title, date: row.date, time: row.time, venue: row.venue, speaker: row.speaker },
  });
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { title, date, time, venue, speaker, capacity, status } = req.body;
  if (!title || !date || !time || !capacity) {
    return res.status(400).json({ error: 'title, date, time and capacity are required.' });
  }
  if (Number(capacity) > 40) {
    return res.status(400).json({ error: 'Capacity cannot exceed 40 seats per session.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await nextSessionId(client);
    const { rows } = await client.query(
      `INSERT INTO pmes_sessions (id, title, date, time_range, venue, speaker, capacity, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *, 0 AS registered_count`,
      [id, title, date, time, venue || null, speaker || null, capacity, status || 'Upcoming']
    );
    await client.query('COMMIT');
    broadcast('pmes-sessions');
    res.status(201).json(toClient(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { title, date, time, venue, speaker, capacity, status } = req.body;
  if (capacity != null && Number(capacity) > 40) {
    return res.status(400).json({ error: 'Capacity cannot exceed 40 seats per session.' });
  }
  const { rows } = await pool.query(
    `UPDATE pmes_sessions
     SET title = COALESCE($1, title),
         date = COALESCE($2, date),
         time_range = COALESCE($3, time_range),
         venue = COALESCE($4, venue),
         speaker = COALESCE($5, speaker),
         capacity = COALESCE($6, capacity),
         status = COALESCE($7, status)
     WHERE id = $8
     RETURNING *`,
    [title, date, time, venue, speaker, capacity, status, req.params.id]
  );
  if (!rows[0]) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  const countResult = await pool.query(
    'SELECT COUNT(*) AS n FROM pmes_registrations WHERE session_id = $1',
    [req.params.id]
  );
  broadcast('pmes-sessions');
  res.json(toClient({ ...rows[0], registered_count: countResult.rows[0].n }));
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM pmes_sessions WHERE id = $1', [req.params.id]);
  if (!rowCount) {
    return res.status(404).json({ error: 'Session not found.' });
  }
  broadcast('pmes-sessions');
  res.status(204).end();
}));

function toRegistrationClient(r) {
  return {
    id: r.id,
    applicantId: r.applicant_id,
    memberId: r.member_id,
    name: r.applicant_name || r.member_name || r.walk_in_name,
    email: r.applicant_email || r.member_email || r.walk_in_email,
    walkIn: !r.applicant_id && !r.member_id,
    registeredAt: r.registered_at,
    attended: r.attended,
    attendedAt: r.attended_at,
    certificateSentAt: r.certificate_sent_at,
  };
}

const REGISTRATION_SELECT = `
  SELECT r.*,
         a.full_name AS applicant_name, a.email AS applicant_email,
         m.name AS member_name, m.email AS member_email
  FROM pmes_registrations r
  LEFT JOIN applicants a ON a.id = r.applicant_id
  LEFT JOIN members m ON m.id = r.member_id
`;

// Admin sees the full roster (needed to call out names not yet checked in).
// The board only ever sees whoever admin has already marked attended - not
// a frontend-only filter, enforced here so the board can't fetch or act on
// anyone who hasn't actually been checked in yet.
router.get('/:id/registrations', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const attendedOnly = req.user.role === 'board';
  const { rows } = await pool.query(
    `${REGISTRATION_SELECT} WHERE r.session_id = $1 ${attendedOnly ? 'AND r.attended = true' : ''} ORDER BY r.registered_at`,
    [req.params.id]
  );
  res.json(rows.map(toRegistrationClient));
}));

// Roll-call check-in: admin-only, working the physical roster at the seminar
// itself - this is the actual attendance evidence, unlike the old bare
// "Mark Attended" click it replaces. The board never touches this; they only
// see whoever admin has already checked in (see GET /:id/registrations) and
// decide whether to send the certificate.
router.patch('/:sessionId/registrations/:regId/attended', requireRole('admin'), asyncHandler(async (req, res) => {
  const attended = !!req.body.attended;
  const { rows } = await pool.query(
    `UPDATE pmes_registrations
     SET attended = $1, attended_at = CASE WHEN $1 THEN now() ELSE NULL END
     WHERE id = $2 AND session_id = $3
     RETURNING *`,
    [attended, req.params.regId, req.params.sessionId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Registration not found for this session.' });

  await auditFromRequest(req, 'pmes_session.attendance_checked', {
    entityType: 'pmes_registration', entityId: String(rows[0].id), metadata: { attended },
  });
  broadcast('pmes-sessions');

  const { rows: joined } = await pool.query(`${REGISTRATION_SELECT} WHERE r.id = $1`, [rows[0].id]);
  res.json(toRegistrationClient(joined[0]));
}));

// Someone who showed up without reserving a slot ahead of time - captured by
// name/email only, same as a walk-in customer at any front desk. Bypasses
// the capacity check below on purpose: they're already physically present,
// this is just recording that fact, not requesting a reservation. Admin-only,
// same reasoning as the attended toggle above - this is part of the roll-call.
router.post('/:sessionId/registrations/walk-in', requireRole('admin'), asyncHandler(async (req, res) => {
  const fullName = (req.body.fullName || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  if (!fullName || !email) {
    return res.status(400).json({ error: 'fullName and email are required.' });
  }

  const sessionCheck = await pool.query('SELECT id FROM pmes_sessions WHERE id = $1', [req.params.sessionId]);
  if (!sessionCheck.rows[0]) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO pmes_registrations (session_id, walk_in_name, walk_in_email, attended, attended_at)
       VALUES ($1, $2, $3, true, now())
       RETURNING *`,
      [req.params.sessionId, fullName, email]
    );
    await auditFromRequest(req, 'pmes_session.walk_in_enrolled', {
      actorEmail: email, entityType: 'pmes_registration', entityId: String(rows[0].id),
    });
    broadcast('pmes-sessions');
    res.status(201).json(toRegistrationClient(rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This email is already checked in for this session.' });
    }
    throw err;
  }
}));

// Board-only: send the certificate for a registration that's actually been
// checked in as attended. If the registration is linked to an applicant,
// keep the applicant's own pmes_attended flag/date in sync so their "Check
// Application Status" page and board review reflect the same confirmation.
router.patch('/:sessionId/registrations/:regId/send-certificate', requireRole('board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `${REGISTRATION_SELECT} WHERE r.id = $1 AND r.session_id = $2`,
    [req.params.regId, req.params.sessionId]
  );
  const reg = rows[0];
  if (!reg) return res.status(404).json({ error: 'Registration not found for this session.' });
  if (!reg.attended) {
    return res.status(400).json({ error: 'This person has not been checked in as attended yet.' });
  }
  if (reg.certificate_sent_at) {
    return res.status(409).json({ error: 'A certificate has already been sent for this registration.' });
  }

  const name = reg.applicant_name || reg.member_name || reg.walk_in_name;
  const email = reg.applicant_email || reg.member_email || reg.walk_in_email;
  const dateAttended = reg.attended_at;

  // The JWT only carries sub/role/memberId (see setAuthCookie in
  // auth.routes.js), not the signed-in person's name, so look up this board
  // member's actual name to print on the certificate instead of just a
  // generic "BOCOFAC Board of Directors" line.
  const { rows: signatoryRows } = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.sub]);
  const signatoryName = signatoryRows[0] && signatoryRows[0].name;

  let emailSent = false;
  let emailError = null;
  let emailPreviewUrl = null;
  let emailIsTest = false;
  try {
    const pdfBuffer = await generatePmesCertificatePdf({ applicantName: name, dateAttended, signatoryName });
    const result = await sendPmesCertificateEmail(email, name, pdfBuffer);
    emailSent = true;
    emailPreviewUrl = result.previewUrl;
    emailIsTest = result.isTest;
  } catch (err) {
    console.error('Failed to email PMES certificate:', err);
    emailError = err.code === 'RECIPIENT_REJECTED' || err.responseCode === 550
      ? "This email address appears to be invalid or inactive."
      : 'Email delivery failed (SMTP error) - see server logs.';
  }

  if (!emailSent) {
    return res.status(502).json({ error: emailError || 'Failed to send certificate email.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE pmes_registrations SET certificate_sent_at = now() WHERE id = $1',
      [reg.id]
    );
    if (reg.applicant_id) {
      await client.query(
        `UPDATE applicants
         SET pmes_attended = true, pmes_date = COALESCE(pmes_date, $2::date),
             status = CASE WHEN status IN ('Draft', 'PMES Pending') THEN 'Pending Review' ELSE status END
         WHERE id = $1`,
        [reg.applicant_id, dateAttended]
      );
    }
    await auditFromRequest(req, 'pmes_session.certificate_sent', {
      db: client, actorEmail: email,
      entityType: 'pmes_registration', entityId: String(reg.id),
      metadata: { applicantId: reg.applicant_id || null, emailIsTest },
    });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  broadcast('pmes-sessions');
  broadcast('applicants');

  const { rows: refreshed } = await pool.query(`${REGISTRATION_SELECT} WHERE r.id = $1`, [reg.id]);
  res.json({ ...toRegistrationClient(refreshed[0]), emailSent, emailError, emailPreviewUrl, emailIsTest });
}));

// Applicants at this stage of the workflow don't have a user account yet
// (they're identified purely by their application's email, same as the
// GET /applicants/by-email lookup this flow follows) - so this stays
// reachable without requireAuth. What it must NOT do is trust a bare
// applicantId/memberId at face value, since either lets a caller register
// an arbitrary third party's slot just by guessing/enumerating an id.
router.post('/:id/register', asyncHandler(async (req, res) => {
  const { applicantId, memberId, email } = req.body;
  let selfName = null;
  let selfEmail = null;
  if (!applicantId && !memberId) {
    // Not everyone reserving a slot has filed an application yet - PMES
    // attendance is required *before* applying, so a signed-in customer with
    // no applicant/member record on file can still self-register here, using
    // their own account's name/email (pulled server-side from the session,
    // never trusted from the request body). Recorded the same way a walk-in
    // check-in is (see the walk-in columns below) so it still surfaces on the
    // session roster and still satisfies GET /attendance-check by email.
    if (!req.user) {
      return res.status(400).json({ error: 'applicantId or memberId is required.' });
    }
    const { rows: selfRows } = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.user.sub]);
    if (!selfRows[0]) {
      return res.status(400).json({ error: 'applicantId or memberId is required.' });
    }
    selfName = selfRows[0].name;
    selfEmail = selfRows[0].email;
  }
  if (applicantId && !email) {
    return res.status(400).json({ error: 'email is required to verify this applicant.' });
  }
  if (memberId) {
    if (!req.user) {
      return res.status(403).json({ error: 'You may only register your own member record.' });
    }
    // Look up member_id fresh from the DB rather than trusting the JWT's
    // memberId claim (same reasoning as GET /members/me) - a member gets
    // linked to a user asynchronously on Board approval, so a session issued
    // before that would otherwise carry a stale/null memberId and wrongly
    // block a freshly-approved member from registering for a seminar.
    const { rows: userRows } = await pool.query('SELECT member_id FROM users WHERE id = $1', [req.user.sub]);
    const actualMemberId = userRows[0] && userRows[0].member_id;
    if (actualMemberId !== memberId) {
      return res.status(403).json({ error: 'You may only register your own member record.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (applicantId) {
      const applicantCheck = await client.query(
        'SELECT id FROM applicants WHERE id = $1 AND lower(email) = lower($2)',
        [applicantId, email]
      );
      if (!applicantCheck.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Applicant id and email do not match.' });
      }
    }

    const sessionResult = await client.query('SELECT * FROM pmes_sessions WHERE id = $1 FOR UPDATE', [req.params.id]);
    const session = sessionResult.rows[0];
    if (!session) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Session not found.' });
    }

    // The self-registration (walk_in_*) shape has no DB unique constraint
    // the way applicant_id/member_id do (see uniq_pmes_reg_applicant/
    // uniq_pmes_reg_member in schema.sql - a walk-in check-in can legitimately
    // repeat a name/email across different people), so this path checks for
    // an existing registration by this exact account email itself.
    if (selfEmail) {
      const dupeCheck = await client.query(
        'SELECT 1 FROM pmes_registrations WHERE session_id = $1 AND lower(walk_in_email) = lower($2)',
        [req.params.id, selfEmail]
      );
      if (dupeCheck.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Already registered for this session.' });
      }
    }

    const countResult = await client.query(
      'SELECT COUNT(*) AS n FROM pmes_registrations WHERE session_id = $1',
      [req.params.id]
    );
    if (Number(countResult.rows[0].n) >= session.capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This session is at full capacity.' });
    }

    await client.query(
      'INSERT INTO pmes_registrations (session_id, applicant_id, member_id, walk_in_name, walk_in_email) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id, applicantId || null, memberId || null, selfName, selfEmail]
    );
    await auditFromRequest(req, 'pmes_session.register', {
      db: client, actorEmail: email || selfEmail || null,
      entityType: 'pmes_session', entityId: req.params.id,
      metadata: { applicantId: applicantId || null, memberId: memberId || null, selfRegistered: !!selfEmail },
    });
    await client.query('COMMIT');
    broadcast('pmes-sessions');
    res.status(201).json({ registered: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Already registered for this session.' });
    }
    throw err;
  } finally {
    client.release();
  }
}));

// Lets the same identity that reserved a slot (applicant, member, or their
// own account) cancel it before attending - mirrors POST /:id/register's
// identity checks exactly, so this can't be used to cancel someone else's
// reservation. Blocked once attendance is already marked, since undoing that
// would contradict the roster/certificate trail already tied to it.
router.delete('/:id/register', asyncHandler(async (req, res) => {
  const { applicantId, memberId, email } = req.body;
  let selfEmail = null;
  if (!applicantId && !memberId) {
    if (!req.user) {
      return res.status(400).json({ error: 'applicantId or memberId is required.' });
    }
    const { rows: selfRows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.sub]);
    if (!selfRows[0]) {
      return res.status(400).json({ error: 'applicantId or memberId is required.' });
    }
    selfEmail = selfRows[0].email;
  }
  if (applicantId && !email) {
    return res.status(400).json({ error: 'email is required to verify this applicant.' });
  }
  if (memberId) {
    if (!req.user) {
      return res.status(403).json({ error: 'You may only cancel your own reservation.' });
    }
    const { rows: userRows } = await pool.query('SELECT member_id FROM users WHERE id = $1', [req.user.sub]);
    const actualMemberId = userRows[0] && userRows[0].member_id;
    if (actualMemberId !== memberId) {
      return res.status(403).json({ error: 'You may only cancel your own reservation.' });
    }
  }

  let where;
  let params;
  if (applicantId) {
    const applicantCheck = await pool.query(
      'SELECT id FROM applicants WHERE id = $1 AND lower(email) = lower($2)',
      [applicantId, email]
    );
    if (!applicantCheck.rows[0]) {
      return res.status(403).json({ error: 'Applicant id and email do not match.' });
    }
    where = 'session_id = $1 AND applicant_id = $2';
    params = [req.params.id, applicantId];
  } else if (memberId) {
    where = 'session_id = $1 AND member_id = $2';
    params = [req.params.id, memberId];
  } else {
    where = 'session_id = $1 AND lower(walk_in_email) = lower($2)';
    params = [req.params.id, selfEmail];
  }

  const { rows } = await pool.query(`SELECT * FROM pmes_registrations WHERE ${where}`, params);
  const reg = rows[0];
  if (!reg) {
    return res.status(404).json({ error: 'No reservation found for this session.' });
  }
  if (reg.attended) {
    return res.status(409).json({ error: 'This attendance is already on record - contact the cooperative if you need it changed.' });
  }

  await pool.query('DELETE FROM pmes_registrations WHERE id = $1', [reg.id]);
  await auditFromRequest(req, 'pmes_session.register_cancelled', {
    actorEmail: email || selfEmail || null,
    entityType: 'pmes_session', entityId: req.params.id,
    metadata: { applicantId: applicantId || null, memberId: memberId || null },
  });
  broadcast('pmes-sessions');
  res.json({ cancelled: true });
}));

module.exports = router;
