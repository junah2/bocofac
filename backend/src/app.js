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

app.set('trust proxy', 1);

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(morgan('dev'));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
// [SECURITY] Ang frontend lang natin (FRONTEND_ORIGIN) ang pwedeng tumawag sa API
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const err = new Error('Origin not allowed by CORS.');
    err.status = 403;
    callback(err);
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
// [AUTH] Binabasa ang login cookie sa bawat request para malaman kung sino ang user
app.use(attachUser);

app.use('/uploads/products', express.static(path.join(UPLOADS_ROOT, 'products')));
app.use('/uploads/avatars', express.static(path.join(UPLOADS_ROOT, 'avatars')));

// [API ROUTES] Lahat ng endpoints ng system (auth, products, members, ledger, orders, atbp.)
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
