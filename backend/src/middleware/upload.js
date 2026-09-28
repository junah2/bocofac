const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

const UPLOADS_SEED_ROOT = path.join(__dirname, '..', '..', 'uploads-seed');

function seedIfEmpty(subfolder, destination) {
  const seedDir = path.join(UPLOADS_SEED_ROOT, subfolder);
  if (!fsSync.existsSync(seedDir)) return;
  if (fsSync.readdirSync(destination).length > 0) return;
  for (const file of fsSync.readdirSync(seedDir)) {
    fsSync.copyFileSync(path.join(seedDir, file), path.join(destination, file));
  }
}

function makeStorage(subfolder, { seedFromDeploy = false } = {}) {
  const destination = path.join(UPLOADS_ROOT, subfolder);
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

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const DOC_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const DOC_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

// [VALIDATION] Chine-check ang totoong laman ng file (hindi lang extension) - image o PDF lang
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

const uploadProductImage = multer({
  storage: makeStorage('products', { seedFromDeploy: true }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: extensionFilter(IMAGE_EXTENSIONS, 'image (JPG/PNG/WebP)'),
});

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
