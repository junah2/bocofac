// OCR for GCash/bank receipt screenshots, shared by checkout and the
// membership fee step. Tesseract misreads the small reference-number text on
// phone screenshots ("9" for "3", a dropped leading digit) unless the text is
// large, so small images are first redrawn at up to 3x size in grayscale -
// on a 460px-wide GCash screenshot that turned a garbled reference into an
// exact read.
const TARGET_WIDTH = 1400;
const MAX_SCALE = 3;

async function upscaleForOcr(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(MAX_SCALE, TARGET_WIDTH / bitmap.width);
    if (scale <= 1) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.filter = 'grayscale(1)';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close && bitmap.close();
    return canvas;
  } catch {
    return file; // unsupported format for canvas - let Tesseract try the original
  }
}

export async function recognizeReceiptText(file) {
  const { default: Tesseract } = await import('tesseract.js');
  const image = await upscaleForOcr(file);
  const { data: { text } } = await Tesseract.recognize(image, 'eng');
  return text;
}
