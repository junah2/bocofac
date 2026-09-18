const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { nextApplicantId, nextMemberId, nextReferenceNumber } = require('../utils/ids');
const { uploadApplicantDoc, verifyUploadedFileType, DOC_MIME_TYPES } = require('../middleware/upload');
const { broadcast } = require('../sse');
const { notifyByEmail } = require('../utils/notify');
const { logAudit, auditFromRequest } = require('../utils/audit');
const { validate } = require('../middleware/validate');
const { applicantCreateSchema } = require('../validation/applicants.schema');
const { applicantLookupLimiter, applicantDocsLimiter } = require('../middleware/rateLimit');
const { validateRequiredShareCapital, MIN_REQUIRED_SHARE_CAPITAL, MAX_REQUIRED_SHARE_CAPITAL } = require('../utils/shareCapital');

const router = express.Router();

function toClient(row, documents, dependents) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    agriculturalType: row.agricultural_type,
    farmSizeHectares: row.farm_size_hectares === null ? null : Number(row.farm_size_hectares),
    address: row.address,
    submittedAt: row.submitted_at,
    status: row.status,
    rejectionReason: row.rejection_reason || undefined,
    pmesAttended: row.pmes_attended,
    pmesDate: row.pmes_date,
    registrationFeePaid: row.registration_fee_paid,
    referenceNumber: row.reference_number,
    createdMemberId: row.created_member_id,
    documentsUploaded: documents || undefined,
    // Personal data sheet fields (paper "Application for Regular Membership" form)
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    suffix: row.suffix,
    addressNumber: row.address_number,
    street: row.street,
    zone: row.zone,
    barangay: row.barangay,
    munCity: row.mun_city,
    civilStatus: row.civil_status,
    birthdate: row.birthdate,
    birthplace: row.birthplace,
    gender: row.gender,
    cpNumber: row.cp_number,
    occupation: row.occupation,
    facebook: row.facebook,
    annualIncome: row.annual_income === null ? null : Number(row.annual_income),
    employer: row.employer,
    businessOwned: row.business_owned,
    tin: row.tin,
    religion: row.religion,
    spouseContactPerson: row.spouse_contact_person,
    spouseCpNumber: row.spouse_cp_number,
    noOfDependents: row.no_of_dependents,
    eduAttainment: row.edu_attainment,
    educomChairperson: row.educom_chairperson,
    idType: row.id_type,
    idNumber: row.id_number,
    idDateIssued: row.id_date_issued,
    idPlaceIssued: row.id_place_issued,
    membershipFee: row.membership_fee === null ? null : Number(row.membership_fee),
    subscribedShare: row.subscribed_share === null ? null : Number(row.subscribed_share),
    paidUpCapital: row.paid_up_capital === null ? null : Number(row.paid_up_capital),
    orNumber: row.or_number,
    farmProfile: row.farm_profile || undefined,
    dependents: dependents || undefined,
  };
}

// GET /by-email/:email is unauthenticated by design (guests self-check their
// application status without an account) - but that means anyone who knows
// or guesses the email gets whatever this returns, with zero proof they're
// the actual applicant. Whitelist only what the "Check Application Status"
// UI actually shows instead of reusing the full toClient() - TIN, ID number,
// birthdate, dependents, farm profile, income, etc. have no business being
// reachable by email-guessing alone.
function toPublicStatusClient(row, pmesCertificateAttached) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    status: row.status,
    rejectionReason: row.rejection_reason || undefined,
    agriculturalType: row.agricultural_type,
    farmSizeHectares: row.farm_size_hectares === null ? null : Number(row.farm_size_hectares),
    referenceNumber: row.reference_number,
    // Just a flag, not the document itself - lets the "Check Application
    // Status" UI stop prompting for a certificate that's already on file
    // without needing the full (staff-only) documentsUploaded set.
    pmesCertificateAttached: !!pmesCertificateAttached,
    barangay: row.barangay,
    munCity: row.mun_city,
    civilStatus: row.civil_status,
    noOfDependents: row.no_of_dependents,
    idType: row.id_type,
    idNumber: row.id_number,
    membershipFee: row.membership_fee === null ? null : Number(row.membership_fee),
    pmesAttended: row.pmes_attended,
    pmesDate: row.pmes_date,
  };
}

async function loadDependents(applicantId) {
  const { rows } = await pool.query(
    'SELECT name, birthdate, age, sex FROM applicant_dependents WHERE applicant_id = $1 ORDER BY id',
    [applicantId]
  );
  return rows.map((r) => ({ name: r.name, birthdate: r.birthdate, age: r.age, sex: r.sex }));
}

async function loadDocumentFlags(applicantId) {
  const { rows } = await pool.query(
    'SELECT doc_type FROM applicant_documents WHERE applicant_id = $1',
    [applicantId]
  );
  const uploaded = new Set(rows.map((r) => r.doc_type));
  return {
    validId: uploaded.has('valid_id'),
    farmDeclaration: uploaded.has('farm_declaration'),
    barangayClearance: uploaded.has('barangay_clearance'),
    pmesCertificate: uploaded.has('pmes_certificate'),
    registrationFeeReceipt: uploaded.has('registration_fee_receipt'),
  };
}

router.get('/', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM applicants ORDER BY submitted_at DESC');
  const withDocs = await Promise.all(rows.map(async (r) => toClient(r, await loadDocumentFlags(r.id), await loadDependents(r.id))));
  res.json(withDocs);
}));

router.get('/by-email/:email', applicantLookupLimiter, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM applicants WHERE lower(email) = lower($1) ORDER BY submitted_at DESC LIMIT 1',
    [req.params.email]
  );
  if (!rows[0]) return res.status(404).json({ error: 'No application found for that email.' });
  const { pmesCertificate } = await loadDocumentFlags(rows[0].id);
  res.json(toPublicStatusClient(rows[0], pmesCertificate));
}));

router.post('/', validate(applicantCreateSchema), asyncHandler(async (req, res) => {
  const {
    fullName, email, phone, agriculturalType, farmSizeHectares, address, registrationFeePaid,
    firstName, middleName, lastName, suffix,
    addressNumber, street, zone, barangay, munCity,
    civilStatus, birthdate, birthplace, gender, cpNumber,
    occupation, facebook, annualIncome, employer, businessOwned, tin, religion,
    spouseContactPerson, spouseCpNumber, dependents,
    eduAttainment, educomChairperson,
    idType, idNumber, idDateIssued, idPlaceIssued,
    subscribedShare, paidUpCapital, orNumber,
    farmProfile,
  } = req.body;
  const dependentList = Array.isArray(dependents) ? dependents.filter((d) => d && d.name) : [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await nextApplicantId(client);
    const referenceNumber = registrationFeePaid ? nextReferenceNumber() : null;
    const { rows } = await client.query(
      `INSERT INTO applicants (
         id, full_name, email, phone, agricultural_type, farm_size_hectares, address, status, registration_fee_paid, reference_number,
         first_name, middle_name, last_name, suffix,
         address_number, street, zone, barangay, mun_city,
         civil_status, birthdate, birthplace, gender, cp_number,
         occupation, facebook, annual_income, employer, business_owned, tin, religion,
         spouse_contact_person, spouse_cp_number, no_of_dependents,
         edu_attainment, educom_chairperson,
         id_type, id_number, id_date_issued, id_place_issued,
         subscribed_share, paid_up_capital, or_number, farm_profile
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,'Draft',$8,$9,
         $10,$11,$12,$13,
         $14,$15,$16,$17,$18,
         $19,$20,$21,$22,$23,
         $24,$25,$26,$27,$28,$29,$30,
         $31,$32,$33,
         $34,$35,
         $36,$37,$38,$39,
         $40,$41,$42,$43
       )
       RETURNING *`,
      [
        id, fullName, email, phone || null, agriculturalType || null, farmSizeHectares || null, address || null, !!registrationFeePaid, referenceNumber,
        firstName || null, middleName || null, lastName || null, suffix || null,
        addressNumber || null, street || null, zone || null, barangay || null, munCity || null,
        civilStatus || null, birthdate || null, birthplace || null, gender || null, cpNumber || null,
        occupation || null, facebook || null, annualIncome || null, employer || null, businessOwned || null, tin || null, religion || null,
        spouseContactPerson || null, spouseCpNumber || null, dependentList.length,
        eduAttainment || null, educomChairperson || null,
        idType || null, idNumber || null, idDateIssued || null, idPlaceIssued || null,
        subscribedShare || null, paidUpCapital || null, orNumber || null, farmProfile ? JSON.stringify(farmProfile) : null,
      ]
    );

    for (const dep of dependentList) {
      await client.query(
        `INSERT INTO applicant_dependents (applicant_id, name, birthdate, age, sex) VALUES ($1,$2,$3,$4,$5)`,
        [id, dep.name, dep.birthdate || null, dep.age || null, dep.sex || null]
      );
    }

    // A guest can attend a PMES seminar in person (walk-in check-in) before
    // ever creating an account/application - recognize that here by email so
    // "Apply for Membership" doesn't stay gated on attendance they already
    // completed.
    let applicantRow = rows[0];
    const walkInMatch = await client.query(
      `SELECT id, attended_at FROM pmes_registrations
       WHERE lower(walk_in_email) = lower($1) AND attended = true AND applicant_id IS NULL
       ORDER BY attended_at DESC LIMIT 1`,
      [email]
    );
    if (walkInMatch.rows[0]) {
      const { rows: updatedRows } = await client.query(
        `UPDATE applicants SET pmes_attended = true, pmes_date = $1 WHERE id = $2 RETURNING *`,
        [walkInMatch.rows[0].attended_at, id]
      );
      applicantRow = updatedRows[0];
      await client.query(
        `UPDATE pmes_registrations SET applicant_id = $1 WHERE id = $2`,
        [id, walkInMatch.rows[0].id]
      );
    }

    await client.query('COMMIT');
    broadcast('applicants');
    res.status(201).json(toClient(
      applicantRow,
      { validId: false, farmDeclaration: false, barangayClearance: false },
      dependentList.map((d) => ({ name: d.name, birthdate: d.birthdate || null, age: d.age || null, sex: d.sex || null }))
    ));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// No account is required to apply (applicants have no user_id/login), so
// this can't be gated behind requireAuth like a normal write endpoint - the
// applicant's own registered email is the only credential available, same
// trust model as GET /by-email/:email above. Without this check, anyone who
// can guess a sequential "APP-123" id could overwrite another applicant's
// valid ID / clearance / receipt with their own files.
router.post('/:id/documents', applicantDocsLimiter, uploadApplicantDoc.single('file'), asyncHandler(async (req, res) => {
  const { docType, email } = req.body;
  const validTypes = ['valid_id', 'farm_declaration', 'barangay_clearance', 'registration_fee_receipt', 'pmes_certificate'];
  if (!validTypes.includes(docType)) {
    return res.status(400).json({ error: `docType must be one of: ${validTypes.join(', ')}` });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'file is required.' });
  }
  if (!(await verifyUploadedFileType(req.file.path, DOC_MIME_TYPES))) {
    return res.status(400).json({ error: 'File content does not match an allowed type (image or PDF).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const applicantCheck = await client.query('SELECT id, email FROM applicants WHERE id = $1', [req.params.id]);
    if (!applicantCheck.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Applicant not found.' });
    }
    if (!email || email.trim().toLowerCase() !== applicantCheck.rows[0].email.toLowerCase()) {
      await client.query('ROLLBACK');
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ error: 'This upload does not match the application on file for that email.' });
    }

    await client.query(
      `INSERT INTO applicant_documents (applicant_id, doc_type, file_path, original_filename)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (applicant_id, doc_type) DO UPDATE SET file_path = EXCLUDED.file_path, original_filename = EXCLUDED.original_filename, uploaded_at = now()`,
      [req.params.id, docType, req.file.path, req.file.originalname]
    );

    // PMES attendance is now a board call (see PATCH /:id/pmes-attended), not
    // something a self-uploaded document can flip - this upload is storage
    // only, e.g. an applicant keeping a copy of the certificate they were
    // emailed after the board confirmed their attendance.
    const { rows } = await client.query('SELECT * FROM applicants WHERE id = $1', [req.params.id]);
    const applicantRow = rows[0];

    await client.query('COMMIT');
    broadcast('applicants');
    const documents = await loadDocumentFlags(req.params.id);
    const dependents = await loadDependents(req.params.id);
    res.status(201).json({ documents, applicant: toClient(applicantRow, documents, dependents) });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.get('/:id/documents/:docType', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT file_path FROM applicant_documents WHERE applicant_id = $1 AND doc_type = $2',
    [req.params.id, req.params.docType]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Document not found.' });
  res.sendFile(path.resolve(rows[0].file_path));
}));

// PMES attendance is now confirmed at the session roster instead of here
// (see PATCH /pmes-sessions/:sessionId/registrations/:regId/send-certificate)
// - that flow requires an actual roll-call check-in record before a
// certificate can go out, instead of trusting a bare board click with no
// evidence behind it. applicants.pmes_attended is still updated from there
// whenever the registration is linked to this applicant.

// Board-only real approve/reject decision. Approval auto-creates a Member (if
// none exists yet for that email) and links any matching customer account, all
// inside one transaction.
router.patch('/:id/status', requireRole('board'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: "status must be 'Approved' or 'Rejected'." });
  }
  const reason = (req.body.reason || '').trim();
  if (status === 'Rejected' && !reason) {
    return res.status(400).json({ error: 'A rejection reason is required.' });
  }

  let requiredShareCapital = 10000;
  if (status === 'Approved' && req.body.requiredShareCapital !== undefined) {
    requiredShareCapital = validateRequiredShareCapital(req.body.requiredShareCapital);
    if (requiredShareCapital === null) {
      return res.status(400).json({
        error: `requiredShareCapital must be between ${MIN_REQUIRED_SHARE_CAPITAL} and ${MAX_REQUIRED_SHARE_CAPITAL}.`,
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const applicantResult = await client.query('SELECT * FROM applicants WHERE id = $1 FOR UPDATE', [req.params.id]);
    const applicant = applicantResult.rows[0];
    if (!applicant) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Applicant not found.' });
    }

    let createdMemberId = applicant.created_member_id;

    if (status === 'Approved') {
      const existingMember = await client.query(
        'SELECT id FROM members WHERE lower(email) = lower($1)',
        [applicant.email]
      );
      if (existingMember.rows[0]) {
        createdMemberId = existingMember.rows[0].id;
      } else {
        createdMemberId = await nextMemberId(client);
        await client.query(
          `INSERT INTO members (id, name, email, required_share_capital, joined_date, status)
           VALUES ($1,$2,$3,$4,CURRENT_DATE,'Active')`,
          [createdMemberId, applicant.full_name, applicant.email, requiredShareCapital]
        );
      }
      await client.query(
        `UPDATE users SET member_id = $1 WHERE lower(email) = lower($2) AND member_id IS NULL`,
        [createdMemberId, applicant.email]
      );
    }

    const { rows } = await client.query(
      `UPDATE applicants
       SET status = $1, reviewed_by = $2, reviewed_at = now(), created_member_id = $3, rejection_reason = $4
       WHERE id = $5
       RETURNING *`,
      [status, req.user.sub, createdMemberId, status === 'Rejected' ? reason : applicant.rejection_reason, req.params.id]
    );

    await notifyByEmail(
      client,
      applicant.email,
      status === 'Approved'
        ? 'Your membership application was approved! Welcome to BOCOFAC.'
        : `Your membership application was rejected: ${reason}`,
      status === 'Approved' ? 'success' : 'error'
    );

    await logAudit(client, {
      actorUserId: req.user.sub, actorRole: req.user.role,
      action: status === 'Approved' ? 'applicant.status.approve' : 'applicant.status.reject',
      entityType: 'applicant', entityId: applicant.id,
      ip: req.ip, userAgent: req.get('user-agent'),
      metadata: { createdMemberId, reason: status === 'Rejected' ? reason : undefined },
    });

    await client.query('COMMIT');
    broadcast('applicants');
    if (status === 'Approved') broadcast('members');
    res.json(toClient(rows[0], await loadDocumentFlags(rows[0].id)));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;
