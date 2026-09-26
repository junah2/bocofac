// Firebase Cloud Functions entry point (package.json "main"). Local dev still
// runs src/server.js via `npm run dev` / `npm start`.
const { onRequest } = require('firebase-functions/v2/https');
const app = require('./src/app');

exports.api = onRequest(
  {
    region: 'asia-southeast1',
    secrets: ['DB_PASS', 'JWT_SECRET', 'BREVO_API_KEY'],
    // A single instance keeps the in-memory pieces working as they did on
    // one server: the /api/events realtime broadcast, and rate-limit counters.
    maxInstances: 1,
    // Below 1 full CPU, Cloud Functions forces one request at a time - an open
    // /api/events stream would then block every other request.
    cpu: 1,
    memory: '512MiB',
    concurrency: 80,
    timeoutSeconds: 300,
  },
  app
);
