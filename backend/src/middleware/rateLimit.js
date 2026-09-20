const rateLimit = require('express-rate-limit');

// Keyed by req.ip. This is deployed behind Railway's reverse proxy, so
// app.js sets `app.set('trust proxy', 1)` - without it, every request would
// share the proxy's own IP (over-blocking everyone together).
function jsonRateLimitHandler(req, res) {
  res.status(429).json({ error: 'Too many attempts. Please try again later.' });
}

const signinLimiter = rateLimit({ // 10 attempts
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

// Guards the code-verification step against brute-forcing the 6-digit code
// (1,000,000 possibilities) - 30 tries per 15 min per IP is still nowhere
// near enough to matter for a brute force, combined with the code's own
// 15-minute expiry, but gives a real customer plenty of room for typos/retries.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

// Both guard the same guest-facing "prove you know this applicant's email"
// trust model (GET /applicants/by-email/:email and POST /:id/documents) -
// without these, either endpoint is a brute-forceable way to enumerate
// emails or the (id, email) pairs needed to write to someone else's application.
const applicantLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

const applicantDocsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

module.exports = {
  signinLimiter, signupLimiter, forgotPasswordLimiter, resetPasswordLimiter,
  applicantLookupLimiter, applicantDocsLimiter,
};
