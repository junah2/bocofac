const { Readable } = require('stream');
const { onRequest } = require('firebase-functions/v2/https');

function replayRawBodyForUploads(req) {
  const type = req.headers['content-type'] || '';
  if (!req.rawBody || !type.startsWith('multipart/form-data')) return;
  const replay = Readable.from([req.rawBody]);
  req.pipe = (destination, options) => replay.pipe(destination, options);
  req.unpipe = (destination) => replay.unpipe(destination);
}

let app;
function handler(req, res) {
  if (!app) app = require('./src/app');
  replayRawBodyForUploads(req);
  return app(req, res);
}

// [DEPLOY] Dito tumatakbo ang buong backend sa Firebase Cloud Functions (function na "api")
exports.api = onRequest(
  {
    region: 'asia-southeast1',
    secrets: ['DB_PASS', 'JWT_SECRET', 'BREVO_API_KEY'],
    maxInstances: 1,
    cpu: 1,
    memory: '512MiB',
    concurrency: 80,
    timeoutSeconds: 300,
  },
  handler
);
