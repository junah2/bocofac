const path = require('path');
const PDFDocument = require('pdfkit');

const COOP_NAME = 'BOCOFAC Coconut Farmers Cooperative';
const COOP_PLACE = 'Sitio Torens, North Villazar, Sipocot, Camarines Sur';
const LOGO_PATH = path.join(__dirname, '../assets/bocofac-logo.jpg');

const GREEN = '#2f6f4b';
const GREEN_DARK = '#1c3b2b';
const GREEN_SOFT = '#f2f8f4';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const AMBER = '#b45309';

const STATUS_LABELS = {
  Draft: 'Waiting for PMES seminar',
  'PMES Pending': 'Waiting for PMES seminar',
  'Pending Review': 'Pending Board Approval',
  Approved: 'Approved',
  Rejected: 'Not approved',
};

const formatDate = (value, withTime = false) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
};
// Bahagi lang ng ID number ang ipinapakita sa dokumento
const maskId = (id) => (id ? `••••${String(id).slice(-4)}` : '—');

// [MEMBERSHIP] PDF ng Filing Summary ng membership application (A4, may logo at checklist)
function generateApplicationSummaryPdf(a) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `BOCOFAC Filing Summary ${a.id}`, Author: COOP_NAME } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    // Header band
    doc.rect(0, 0, doc.page.width, 110).fill(GREEN_DARK);
    try { doc.image(LOGO_PATH, left, 26, { width: 58, height: 58 }); } catch { /* walang logo - tuloy pa rin */ }
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text(COOP_NAME, left + 72, 32, { width: width - 72 });
    doc.font('Helvetica').fontSize(9.5).fillColor('#c2dfcb').text(COOP_PLACE, left + 72, 54, { width: width - 72 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('Membership Application · Filing Summary', left + 72, 72, { width: width - 72 });

    // Status card
    let y = 134;
    // Kapag nakadalo na sa PMES at hindi pa desisyon ng Board, naghihintay na lang ng approval
    const decided = a.status === 'Approved' || a.status === 'Rejected';
    const statusLabel = !decided && a.pmesAttended ? 'Pending Board Approval' : STATUS_LABELS[a.status] || a.status || '—';
    doc.roundedRect(left, y, width, 64, 8).fill(GREEN_SOFT);
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('APPLICATION ID', left + 16, y + 14);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text(a.id, left + 16, y + 28);
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('STATUS', left + width / 2, y + 14);
    doc.fillColor(a.status === 'Rejected' ? '#be123c' : a.status === 'Approved' ? GREEN : AMBER)
      .font('Helvetica-Bold').fontSize(14).text(statusLabel, left + width / 2, y + 30, { width: width / 2 - 16 });
    y += 84;

    const section = (title) => {
      doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10).text(title.toUpperCase(), left, y, { characterSpacing: 0.6 });
      y += 16;
      doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1).strokeColor(LINE).stroke();
      y += 8;
    };
    const row = (label, value) => {
      const text = value === null || value === undefined || value === '' ? '—' : String(value);
      doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(label, left, y, { width: 170 });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(text, left + 180, y, { width: width - 180 });
      y = Math.max(doc.y, y + 14) + 6;
    };

    section('Applicant');
    row('Full name', a.fullName);
    row('Email', a.email);
    row('Mobile number', a.phone);
    row('Address', [a.barangay, a.munCity].filter(Boolean).join(', '));
    row('Civil status', a.civilStatus);
    row('No. of dependents', a.noOfDependents);
    row('Valid ID', a.idType ? `${a.idType} (${maskId(a.idNumber)})` : '—');
    y += 10;

    section('Application');
    row('Date filed', formatDate(a.submittedAt, true));
    row('Payment reference no.', a.referenceNumber);
    row('Membership fee', a.membershipFee !== null && a.membershipFee !== undefined ? `PHP ${Number(a.membershipFee).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—');
    row('PMES seminar', a.pmesAttended ? `Attended${a.pmesDate ? ` on ${formatDate(a.pmesDate)}` : ''}` : 'Not yet attended');
    if (a.status === 'Rejected' && a.rejectionReason) row('Board remarks', a.rejectionReason);
    y += 10;

    section('Compliance checklist');
    const check = (label, done, note) => {
      doc.circle(left + 7, y + 6, 6).fill(done ? GREEN : '#cbd5e1');
      if (done) doc.moveTo(left + 4, y + 6).lineTo(left + 6.3, y + 8.5).lineTo(left + 10.2, y + 3.6).lineWidth(1.6).strokeColor('#ffffff').stroke();
      doc.fillColor(INK).font('Helvetica').fontSize(10).text(label, left + 22, y + 1, { width: width - 200 });
      doc.fillColor(done ? GREEN : MUTED).font('Helvetica-Bold').fontSize(10).text(note, left + width - 170, y + 1, { width: 170, align: 'right' });
      y += 24;
    };
    check('Government ID uploaded', !!a.validIdUploaded, a.validIdUploaded ? 'Uploaded' : 'Missing');
    check('Membership fee (PHP 300)', !!a.registrationFeePaid || !!a.referenceNumber, a.registrationFeePaid || a.referenceNumber ? 'Paid' : 'Not yet paid');
    check('Pre-Membership Education Seminar (PMES)', !!a.pmesAttended, a.pmesAttended ? (a.pmesCertificateAttached ? 'Attended · certificate on file' : 'Attended') : 'Pending');

    // Next step box
    y += 6;
    const nextStep = a.status === 'Approved'
      ? 'Your membership has been approved. Welcome to BOCOFAC!'
      : a.status === 'Rejected'
        ? 'The Board did not approve this application. Please contact the BOCOFAC office for details.'
        : a.pmesAttended
          ? 'Your application is complete and is waiting for the Board of Directors\' approval. You will be notified by email.'
          : 'Next step: attend a face-to-face PMES seminar. The Board can review your application after you attend.';
    doc.roundedRect(left, y, width, 46, 8).lineWidth(1).strokeColor(LINE).stroke();
    doc.fillColor(INK).font('Helvetica').fontSize(10).text(nextStep, left + 14, y + 12, { width: width - 28 });

    // Footer
    const footerY = doc.page.height - doc.page.margins.bottom - 24;
    doc.moveTo(left, footerY).lineTo(left + width, footerY).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text(`Generated ${formatDate(new Date(), true)} · ${COOP_NAME} · info@bocofac.coop · 0917-889-4402`, left, footerY + 8, { width, align: 'center' });

    doc.end();
  });
}

module.exports = { generateApplicationSummaryPdf };
