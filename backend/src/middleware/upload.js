const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// On Railway (and most container/PaaS hosts) the app's own filesystem is
// ephemeral - anything written here gets wiped on every redeploy, restart,
// or scale event, not just a fresh clone. UPLOADS_DIR should point at a
// mounted persistent Volume in production (e.g. "/data/uploads" - see
// Railway's Volumes settings for this service); it falls back to a local
// "uploads" folder next to the repo for development, where the plain
// filesystem already persists fine on its own.
const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

// A one-time, git-tracked snapshot of the product photos/avatars that were
// on file as of the deploy-persistence fix - copied into a freshly attached
// (empty) Volume on first boot so the storefront isn't blank right after
// switching to persistent storage. Deliberately doesn't cover
// applicants/orders: those are private documents (IDs, payment
// screenshots), not brand assets, and have no business sitting in git.
const UPLOADS_SEED_ROOT = path.join(__dirname, '..', '..', 'uploads-seed');

function seedIfEmpty(subfolder, destination) {
  const seedDir = path.join(UPLOADS_SEED_ROOT, subfolder);
  if (!fsSync.existsSync(seedDir)) return;
  if (fsSync.readdirSync(destination).length > 0) return; // real content already there - never overwrite
  for (const file of fsSync.readdirSync(seedDir)) {
    fsSync.copyFileSync(path.join(seedDir, file), path.join(destination, file));
  }
}

function makeStorage(subfolder, { seedFromDeploy = false } = {}) {
  const destination = path.join(UPLOADS_ROOT, subfolder);
  // multer.diskStorage never creates its destination - it just errors
  // (ENOENT) if the folder isn't already there. Locally it always exists
  // because dev uploads accumulate in it over time, but a freshly deployed
  // server only has what git actually tracked; an empty folder with nothing
  // in it isn't trackable by git at all, so this recreates it defensively
  // on every boot instead of relying on deploy-time file layout.
  fsSync.mkdirSync(destination, { recursive: true });
  if (seedFromDeploy) seedIfEmpty(subfolder, destination);
  return multer.diskStorage({
    destination,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const DOC_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const DOC_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// multer's fileFilter only ever sees the client-supplied filename/mimetype
// (the stream hasn't been written to disk yet) - this is a fast first-pass
// reject on extension, independent of whatever Content-Type the client
// claims. The real check is verifyUploadedFileType below, which sniffs the
// actual bytes after multer has written the file.
function extensionFilter(allowedExtensions, label) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      const err = new Error(`Only ${label} files are allowed.`);
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  };
}

// Sniffs the real content type from the file's magic bytes (not the
// client-supplied mimetype/filename, both of which are trivially spoofable -
// e.g. renaming an executable to "photo.jpg"). Deletes the file and returns
// false if it doesn't match an allowed type; callers should respond 400.
// file-type is ESM-only, so it's loaded via dynamic import() from this
// CommonJS module.
async function verifyUploadedFileType(filePath, allowedMimeTypes) {
  const { fileTypeFromFile } = await import('file-type');
  const detected = await fileTypeFromFile(filePath);
  if (!detected || !allowedMimeTypes.includes(detected.mime)) {
    await fs.unlink(filePath).catch(() => {});
    return false;
  }
  return true;
}

const uploadApplicantDoc = multer({
  storage: makeStorage('applicants'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: extensionFilter(DOC_EXTENSIONS, 'image (JPG/PNG/WebP) or PDF'),
});

const uploadOrderReceipt = multer({
  storage: makeStorage('orders'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: extensionFilter(DOC_EXTENSIONS, 'image (JPG/PNG/WebP) or PDF'),
});

// Product photos are served publicly (see the /uploads/products static mount
// in app.js), unlike applicant docs/receipts which stay behind an
// authenticated sendFile route - so this one also restricts to actual image
// types rather than accepting any file.
const uploadProductImage = multer({
  storage: makeStorage('products', { seedFromDeploy: true }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: extensionFilter(IMAGE_EXTENSIONS, 'image (JPG/PNG/WebP)'),
});

// Profile avatars are publicly served (see the /uploads/avatars static
// mount in app.js), same reasoning as product photos above.
const uploadAvatar = multer({
  storage: makeStorage('avatars', { seedFromDeploy: true }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: extensionFilter(IMAGE_EXTENSIONS, 'image (JPG/PNG/WebP)'),
});

module.exports = {
  UPLOADS_ROOT,
  uploadApplicantDoc,
  uploadOrderReceipt,
  uploadProductImage,
  uploadAvatar,
  verifyUploadedFileType,
  DOC_MIME_TYPES,
  IMAGE_MIME_TYPES,
};
