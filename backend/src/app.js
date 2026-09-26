require('./loadEnv');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { UPLOADS_ROOT } = require('./middleware/upload');

const { attachUser } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const productsRoutes = require('./routes/products.routes');
const membersRoutes = require('./routes/members.routes');
const ledgerRoutes = require('./routes/ledger.routes');
const applicantsRoutes = require('./routes/applicants.routes');
const pmesSessionsRoutes = require('./routes/pmesSessions.routes');
const ordersRoutes = require('./routes/orders.routes');
const withdrawalsRoutes = require('./routes/withdrawals.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const messagesRoutes = require('./routes/messages.routes');
const eventsRoutes = require('./routes/events.routes');
const auditLogRoutes = require('./routes/auditLog.routes');

const app = express();

// The hosting platform (like most PaaS hosts) sits in front of this app as a reverse
// proxy, adding an X-Forwarded-For header with the real client IP. Trusting
// exactly one hop tells Express/express-rate-limit to key rate limits off
// that real IP instead of either erroring on the unexpected header (see
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) or, if trusted too broadly, letting a
// client spoof its own X-Forwarded-For to dodge rate limiting.
app.set('trust proxy', 1);

// Only these origins may make credentialed (cookie-carrying) requests.
// FRONTEND_ORIGIN can hold a comma-separated list for local dev (e.g. a LAN
// IP or a forwarded/tunneled dev URL alongside plain localhost) - it must
// never fall back to reflecting an arbitrary origin, since that combined
// with credentials:true would let any website ride a visitor's auth cookie.
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(morgan('dev'));
// crossOriginResourcePolicy relaxed to 'cross-origin' so the frontend (a
// different origin/port in dev, per FRONTEND_ORIGIN) can still load images
// from the /uploads/products static mount below. CSP left off: this is an
// API-only server that never serves the frontend's HTML/JS itself, so
// helmet's default (page-oriented) CSP has nothing correct to apply here.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    // No Origin header means a same-origin/non-browser request (curl,
    // server-to-server, mobile app) - nothing to check against a browser
    // origin allowlist for those.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const err = new Error('Origin not allowed by CORS.');
    err.status = 403;
    callback(err);
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(attachUser);

// Product photos and profile avatars are the only uploads meant to be
// publicly viewable (the storefront/navbar show them to anyone) - applicant
// docs and order receipts stay private behind their own authenticated
// sendFile routes.
app.use('/uploads/products', express.static(path.join(UPLOADS_ROOT, 'products')));
app.use('/uploads/avatars', express.static(path.join(UPLOADS_ROOT, 'avatars')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/applicants', applicantsRoutes);
app.use('/api/pmes-sessions', pmesSessionsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/withdrawals', withdrawalsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/audit-log', auditLogRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(errorHandler);

module.exports = app;
