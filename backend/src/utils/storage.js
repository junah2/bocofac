const fs = require('fs');
const path = require('path');
const { UPLOADS_ROOT } = require('../middleware/upload');

// [STORAGE] Sa live, nabubura ang disk ng Cloud Function tuwing nagre-restart, kaya kinokopya rin ang bawat
// upload sa Firebase Storage (STORAGE_BUCKET). Ang disk ay nagsisilbing cache lang: kapag wala na roon ang file,
// kinukuha ulit sa bucket. Kapag walang STORAGE_BUCKET (local dev), disk lang ang gamit.
let bucket;
function getBucket() {
  if (!process.env.STORAGE_BUCKET) return null;
  if (!bucket) {
    const { initializeApp, getApps } = require('firebase-admin/app');
    const { getStorage } = require('firebase-admin/storage');
    if (!getApps().length) initializeApp();
    bucket = getStorage().bucket(process.env.STORAGE_BUCKET);
  }
  return bucket;
}

// Ang pangalan sa bucket ay ang landas sa loob ng uploads folder, hal. "products/abc.png"
function objectKey(filePath) {
  const relative = path.relative(UPLOADS_ROOT, path.resolve(filePath));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join('/');
}

async function persistUpload(file) {
  const b = getBucket();
  const key = file && objectKey(file.path);
  if (!b || !key) return;
  try {
    await b.upload(file.path, { destination: key, contentType: file.mimetype, resumable: false });
  } catch (err) {
    // Hindi pinapalya ang upload: nasa disk pa rin ang file, pero mawawala ito sa susunod na restart
    console.error('Could not copy upload to Firebase Storage:', key, err.message);
  }
}

// Ibinabalik ang file sa disk mula sa bucket kung nawala na ito (true kung nandoon na ulit)
async function restoreFromBucket(filePath) {
  if (fs.existsSync(filePath)) return true;
  const b = getBucket();
  const key = objectKey(filePath);
  if (!b || !key) return false;
  try {
    const remote = b.file(key);
    const [exists] = await remote.exists();
    if (!exists) return false;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    await remote.download({ destination: filePath });
    return true;
  } catch (err) {
    console.error('Could not read upload from Firebase Storage:', key, err.message);
    return false;
  }
}

// Para sa mga file na naka-save ang buong landas sa database (resibo, dokumento ng aplikante)
async function sendStoredFile(res, storedPath) {
  const filePath = path.resolve(storedPath);
  if (!(await restoreFromBucket(filePath))) {
    return res.status(404).json({ error: 'The file is no longer available.' });
  }
  res.sendFile(filePath);
}

// Para sa /uploads/products at /uploads/avatars: kapag wala sa disk, kinukuha sa bucket
function bucketFallback(subfolder) {
  const folder = path.join(UPLOADS_ROOT, subfolder);
  return async (req, res, next) => {
    try {
      const name = path.basename(decodeURIComponent(req.path));
      if (!name || name.startsWith('.')) return next();
      const filePath = path.join(folder, name);
      if (await restoreFromBucket(filePath)) return res.sendFile(filePath);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { persistUpload, sendStoredFile, bucketFallback };
