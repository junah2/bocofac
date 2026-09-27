const path = require('path');
const PDFDocument = require('pdfkit');

const COOP_NAME = 'BOCOFAC Coconut Farmers Cooperative';
const COOP_PLACE = 'Sipocot, Camarines Sur';
// Same artwork as the frontend navbar (frontend/src/assets/bocofac-logo.jpg),
// kept as its own backend copy rather than reaching across into the frontend
// folder - the two apps can be deployed/hosted independently, so this
// certificate generator shouldn't depend on the frontend's file layout.
const LOGO_PATH = path.join(__dirname, '../assets/bocofac-logo.jpg');

const GREEN = '#0b4d3a';
const GREEN_SOFT = '#3f6f5c';
const GOLD = '#b8912f';
const INK = '#1f2933';
const MUTED = '#5b6770';
const PAPER = '#fbf8ef';

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Gold L-shaped flourish in each corner, just inside the inner border.
function drawCorners(doc, x, y, w, h, len) {
  doc.save().lineWidth(2).strokeColor(GOLD);
  [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, dx, dy]) => {
    doc.moveTo(cx, cy + dy * len).lineTo(cx, cy).lineTo(cx + dx * len, cy).stroke();
    doc.circle(cx + dx * 6, cy + dy * 6, 2).fill(GOLD);
  });
  doc.restore();
}

function signatureBlock(doc, centerX, y, name, title) {
  const half = 115;
  doc.moveTo(centerX - half, y).lineTo(centerX + half, y).lineWidth(1).strokeColor(INK).stroke();
  doc.font('Times-Bold').fontSize(15).fillColor(INK)
    .text(name, centerX - half - 20, y + 8, { width: (half + 20) * 2, align: 'center' });
  doc.font('Helvetica').fontSize(10.5).fillColor(MUTED)
    .text(title, centerX - half - 20, y + 28, { width: (half + 20) * 2, align: 'center' });
}

// Renders the PMES certificate straight into a Buffer (no disk write) so it
// can go directly into an email attachment.
function generatePmesCertificatePdf({ applicantName, dateAttended, signatoryName }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { width, height } = doc.page;
    const attended = dateAttended ? new Date(dateAttended) : new Date();
    const dateOpts = { timeZone: 'Asia/Manila' };
    const day = Number(attended.toLocaleDateString('en-PH', { ...dateOpts, day: 'numeric' }));
    const month = attended.toLocaleDateString('en-PH', { ...dateOpts, month: 'long' });
    const year = attended.toLocaleDateString('en-PH', { ...dateOpts, year: 'numeric' });
    const chairpersonName = (process.env.CHAIRPERSON_NAME || '').trim();

    // Paper, borders, corner flourishes.
    doc.rect(0, 0, width, height).fill(PAPER);
    doc.lineWidth(6).strokeColor(GREEN).rect(18, 18, width - 36, height - 36).stroke();
    doc.lineWidth(1.2).strokeColor(GOLD).rect(30, 30, width - 60, height - 60).stroke();
    doc.lineWidth(0.6).strokeColor(GREEN_SOFT).rect(35, 35, width - 70, height - 70).stroke();
    drawCorners(doc, 44, 44, width - 88, height - 88, 34);

    // Faint logo watermark behind the text. The logo JPG has a white square
    // background, so both copies are clipped to its circular seal.
    const markSize = 300;
    const markX = width / 2 - markSize / 2;
    const markY = height / 2 - markSize / 2 + 20;
    doc.save().circle(width / 2, markY + markSize / 2, markSize / 2 - 4).clip().opacity(0.06)
      .image(LOGO_PATH, markX, markY, { width: markSize, height: markSize })
      .restore();

    // Header.
    const logoSize = 78;
    doc.save().circle(width / 2, 52 + logoSize / 2, logoSize / 2 - 1).clip()
      .image(LOGO_PATH, width / 2 - logoSize / 2, 52, { width: logoSize, height: logoSize })
      .restore();
    doc.font('Helvetica-Bold').fontSize(13).fillColor(GREEN)
      .text(COOP_NAME.toUpperCase(), 0, 140, { align: 'center', characterSpacing: 2 });

    // Title.
    doc.font('Times-Bold').fontSize(46).fillColor(GREEN)
      .text('CERTIFICATE', 0, 164, { align: 'center', characterSpacing: 4 });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(GOLD)
      .text('OF ATTENDANCE', 0, 214, { align: 'center', characterSpacing: 6 });

    doc.font('Times-Italic').fontSize(15).fillColor(MUTED)
      .text('This certificate is proudly presented to', 0, 248, { align: 'center' });

    // Recipient name with a gold rule underneath - shrunk as needed so a long
    // name stays on one line instead of wrapping into the rule.
    const recipient = applicantName || 'Applicant';
    const nameMaxWidth = width - 170;
    let nameSize = 38;
    doc.font('Times-BoldItalic');
    while (nameSize > 22 && doc.fontSize(nameSize).widthOfString(recipient) > nameMaxWidth) nameSize -= 1;
    doc.fontSize(nameSize).fillColor(INK)
      .text(recipient, 60, 272 + (38 - nameSize) / 2, { align: 'center', width: width - 120, lineBreak: false });
    doc.moveTo(width / 2 - 190, 322).lineTo(width / 2 + 190, 322).lineWidth(1.2).strokeColor(GOLD).stroke();

    doc.font('Helvetica').fontSize(14).fillColor(INK)
      .text(
        'for successfully attending the Pre-Membership Education Seminar (PMES), ' +
        `a requirement for membership in the ${COOP_NAME}.`,
        130, 338, { align: 'center', width: width - 260, lineGap: 3 }
      );

    doc.font('Times-Italic').fontSize(13.5).fillColor(MUTED)
      .text(`Given this ${ordinal(day)} day of ${month} ${year} at ${COOP_PLACE}.`, 0, 392, { align: 'center' });

    // Signatures: the board member who confirmed the attendance, and the
    // chairperson (set via CHAIRPERSON_NAME, so a change after a board
    // election needs no code change). Falls back to one centered block if the
    // chairperson isn't configured.
    const sigY = height - 118;
    const confirmer = signatoryName || 'BOCOFAC Board of Directors';
    if (chairpersonName) {
      signatureBlock(doc, width / 2 - 190, sigY, confirmer, 'Board of Directors');
      signatureBlock(doc, width / 2 + 190, sigY, chairpersonName, 'Chairperson, Board of Directors');
    } else {
      signatureBlock(doc, width / 2, sigY, confirmer, 'Board of Directors');
    }

    doc.end();
  });
}

module.exports = { generatePmesCertificatePdf };
