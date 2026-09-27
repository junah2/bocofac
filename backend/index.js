// Firebase Cloud Functions entry point (package.json "main"). Local dev still
// runs src/server.js via `npm run dev` / `npm start`.
const { Readable } = require('stream');
const { onRequest } = require('firebase-functions/v2/https');

// Cloud Functions reads the whole request body before the app sees it
// (keeping the bytes in req.rawBody), so multer - which reads uploads by
// piping the request stream - would find nothing left and fail every file
// upload (order receipts, applicant documents, avatars, product photos).
// multer only ever calls req.pipe/req.unpipe on the request, so point those
// at a replay of the raw body for multipart requests.
function replayRawBodyForUploads(req) {
  const type = req.headers['content-type'] || '';
  if (!req.rawBody || !type.startsWith('multipart/form-data')) return;
  const replay = Readable.from([req.rawBody]);
  req.pipe = (destination, options) => replay.pipe(destination, options);
  req.unpipe = (destination) => replay.unpipe(destination);
}

// Loaded on the first request rather than at import time: `firebase deploy`
// imports this file just to list the functions and gives up after 10s, and
// the full Express app (every route, pdfkit, mailer, firebase-admin) can
// blow past that on a cold machine.
let app;
function handler(req, res) {
  if (!app) app = require('./src/app');
  replayRawBodyForUploads(req);
  return app(req, res);
}

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
  handler
);
