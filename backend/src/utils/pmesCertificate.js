const path = require('path');
const PDFDocument = require('pdfkit');

const COOP_NAME = 'BOCOFAC Coconut Farmers Cooperative';
// Same artwork as the frontend navbar (frontend/src/assets/bocofac-logo.jpg),
// kept as its own backend copy rather than reaching across into the frontend
// folder - the two apps can be deployed/hosted independently, so this
// certificate generator shouldn't depend on the frontend's file layout.
const LOGO_PATH = path.join(__dirname, '../assets/bocofac-logo.jpg');

// Renders the PMES certificate straight into a Buffer (no disk write) so it
// can go directly into a nodemailer attachment.
function generatePmesCertificatePdf({ applicantName, dateAttended, signatoryName }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { width, height } = doc.page;
    const formattedDate = dateAttended
      ? new Date(dateAttended).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.lineWidth(2).strokeColor('#065f46').rect(24, 24, width - 48, height - 48).stroke();
    doc.lineWidth(0.75).strokeColor('#a7f3d0').rect(34, 34, width - 68, height - 68).stroke();

    const logoSize = 64;
    doc.image(LOGO_PATH, width / 2 - logoSize / 2, 38, { width: logoSize, height: logoSize });

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#065f46')
      .text(COOP_NAME.toUpperCase(), 0, 112, { align: 'center' });

    doc.font('Helvetica-Bold').fontSize(30).fillColor('#0f172a')
      .text('Certificate of Attendance', 0, 150, { align: 'center' });

    doc.font('Helvetica').fontSize(13).fillColor('#475569')
      .text('Pre-Membership Education Seminar (PMES)', 0, 195, { align: 'center' });

    doc.font('Helvetica').fontSize(12).fillColor('#334155')
      .text('This certificate is proudly presented to', 0, 235, { align: 'center' });

    doc.font('Helvetica-Bold').fontSize(24).fillColor('#065f46')
      .text(applicantName || 'Applicant', 0, 260, { align: 'center' });

    doc.font('Helvetica').fontSize(12).fillColor('#334155')
      .text(
        'for successfully attending the Pre-Membership Education Seminar, a requirement for membership under the BOCOFAC Coconut Farmers Cooperative.',
        120, 305, { align: 'center', width: width - 240 }
      );

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
      .text(`Date Attended: ${formattedDate}`, 0, 355, { align: 'center' });

    // Signature block: the actual board member who confirmed/sent this
    // certificate, not just a generic "BOCOFAC Board of Directors" label -
    // so the certificate shows who specifically vouched for the attendance.
    const signatureY = height - 120;
    doc.moveTo(width / 2 - 110, signatureY).lineTo(width / 2 + 110, signatureY).strokeColor('#94a3b8').lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
      .text(signatoryName || 'BOCOFAC Board of Directors', 0, signatureY + 8, { align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#64748b')
      .text('BOCOFAC Board of Directors', 0, signatureY + 26, { align: 'center' });

    doc.end();
  });
}

module.exports = { generatePmesCertificatePdf };
