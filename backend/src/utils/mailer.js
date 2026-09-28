const nodemailer = require('nodemailer');

let transporterPromise = null;
let usingEtherealTestInbox = false;

function usingBrevoApi() {
  return !!(process.env.BREVO_API_KEY || '').trim();
}

function senderEmail() {
  return process.env.SMTP_FROM || process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'no-reply@bocofac.coop';
}

// [EMAIL] Nagse-send ng email (reset code, PMES certificate) gamit ang Brevo API
async function sendViaBrevoApi({ to, subject, html, attachments }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY.trim(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'BOCOFAC', email: senderEmail() },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(attachments && attachments.length
        ? { attachment: attachments.map(a => ({ name: a.filename, content: a.content.toString('base64') })) }
        : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Brevo API send failed (${res.status}): ${body.slice(0, 300)}`);
    err.code = 'BREVO_API_ERROR';
    throw err;
  }
}

function getTransporter() {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const smtpPort = Number(process.env.SMTP_PORT) || 465;
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: smtpPort,
        secure: smtpPort === 465,
        family: 4,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    usingEtherealTestInbox = true;
    const testAccount = await nodemailer.createTestAccount();
    console.warn(
      'SMTP_USER/SMTP_PASS not set - using a disposable Ethereal test inbox. ' +
      'Emails will NOT reach real recipients; each send logs a preview URL instead.'
    );
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      family: 4,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  })();

  return transporterPromise;
}

function fromAddress() {
  return senderEmail();
}

async function sendPasswordResetCodeEmail(to, code) {
  const subject = 'Your BOCOFAC password reset code';
  const html = `
    <p>We received a request to reset your BOCOFAC account password.</p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 20px 0;">${code}</p>
    <p>Enter this code on the password reset page. It expires in 15 minutes.</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `;

  if (usingBrevoApi()) {
    await sendViaBrevoApi({ to, subject, html });
    return;
  }

  const transporter = await getTransporter();
  await transporter.sendMail({ from: fromAddress(), to, subject, html });
}

async function sendPmesCertificateEmail(to, applicantName, pdfBuffer) {
  const subject = 'Your BOCOFAC PMES Certificate of Attendance';
  const html = `
    <p>Hi ${applicantName || 'there'},</p>
    <p>The BOCOFAC Board of Directors has confirmed your attendance at the Pre-Membership Education Seminar (PMES).</p>
    <p>Your certificate is attached to this email. Keep a copy for your records — you can also attach it to your application under the "Check Application Status" tab.</p>
  `;

  if (usingBrevoApi()) {
    await sendViaBrevoApi({
      to,
      subject,
      html,
      attachments: [{ filename: 'PMES-Certificate.pdf', content: pdfBuffer }],
    });
    return { previewUrl: null, isTest: false };
  }

  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: fromAddress(),
    to,
    subject,
    html,
    attachments: [
      {
        filename: 'PMES-Certificate.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  if (info.rejected && info.rejected.length > 0) {
    const err = new Error(`Recipient rejected by mail server: ${info.rejected.join(', ')}`);
    err.code = 'RECIPIENT_REJECTED';
    throw err;
  }

  return {
    previewUrl: usingEtherealTestInbox ? nodemailer.getTestMessageUrl(info) || null : null,
    isTest: usingEtherealTestInbox,
  };
}

function isMailConfigured() {
  return usingBrevoApi() || !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

module.exports = { sendPasswordResetCodeEmail, sendPmesCertificateEmail, isMailConfigured };
