const nodemailer = require('nodemailer');

let transporterPromise = null;
let usingEtherealTestInbox = false;

// Real SMTP (SMTP_USER/SMTP_PASS in .env) is used when configured. Until
// then, this lazily spins up a disposable Ethereal test inbox via
// nodemailer's own API (no signup, no verification) so email-dependent
// flows still work end-to-end in development. Mail sent through Ethereal
// never reaches a real inbox - each send instead gets a preview URL.
function getTransporter() {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const smtpPort = Number(process.env.SMTP_PORT) || 465;
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: smtpPort,
        // Port 465 is implicit TLS; other ports (587, etc. - used by most
        // SMTP relays other than Gmail) negotiate TLS via STARTTLS instead,
        // which nodemailer only does when `secure` is false.
        secure: smtpPort === 465,
        // Many container hosts (Railway included) advertise IPv6 but can't
        // actually route it, so a connection to Gmail's AAAA address just
        // hangs until it times out instead of falling back to IPv4. Forcing
        // IPv4 here skips that dead end.
        family: 4,
        // Nodemailer's defaults (2min/30s/10min) mean a blocked/blackholed
        // host can sit "sending" for up to 10 minutes before the fire-and-
        // forget callers below ever log a failure. Fail fast instead so a
        // network-level block surfaces in seconds, not minutes.
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
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@bocofac.coop';
}

// Code instead of a clickable link - simpler to deliver reliably (no link
// scanners/proxies rewriting or pre-fetching it, nothing for a mail client
// to flag) and the customer just types it back into the same page.
async function sendPasswordResetCodeEmail(to, code) {
  console.log('[mailer] getting transporter...');
  const transporter = await getTransporter();
  console.log('[mailer] transporter ready, calling sendMail...');
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: 'Your BOCOFAC password reset code',
    html: `
      <p>We received a request to reset your BOCOFAC account password.</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 20px 0;">${code}</p>
      <p>Enter this code on the password reset page. It expires in 15 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

// Returns { previewUrl, isTest } - previewUrl is set (Ethereal-hosted, not a
// real inbox) whenever no real SMTP is configured yet; isTest flags that case
// so callers can tell the difference from an actual delivery.
async function sendPmesCertificateEmail(to, applicantName, pdfBuffer) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: 'Your BOCOFAC PMES Certificate of Attendance',
    html: `
      <p>Hi ${applicantName || 'there'},</p>
      <p>The BOCOFAC Board of Directors has confirmed your attendance at the Pre-Membership Education Seminar (PMES).</p>
      <p>Your certificate is attached to this email. Keep a copy for your records — you can also attach it to your application under the "Check Application Status" tab.</p>
    `,
    attachments: [
      {
        filename: 'PMES-Certificate.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  // The SMTP server accepted the message but flagged this recipient as
  // undeliverable (bad/inactive mailbox) - nodemailer surfaces that as a
  // non-empty `rejected` list rather than throwing.
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

// True once SMTP_USER/SMTP_PASS are actually filled in (they ship blank in
// .env.example) - lets callers tell a real send apart from the Ethereal
// test-inbox fallback above.
function isMailConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

module.exports = { sendPasswordResetCodeEmail, sendPmesCertificateEmail, isMailConfigured };
