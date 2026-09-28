const TARGET_WIDTH = 1400;
const MAX_SCALE = 3;

// [OCR] Pinapalaki at ginagawang grayscale ang picture para mas mabasa ang reference number
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
    return file;
  }
}

export async function recognizeReceiptText(file) {
  const { default: Tesseract } = await import('tesseract.js');
  const image = await upscaleForOcr(file);
  const { data: { text } } = await Tesseract.recognize(image, 'eng');
  return text;
}
