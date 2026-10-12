import { createWorker, PSM, type Worker } from 'tesseract.js';
let active: Worker | undefined;
let generation = 0;
export async function cancelRecognition() { generation++; const worker = active; active = undefined; await worker?.terminate(); }
export async function recognize(image: string, progress: (value: string) => void): Promise<string> {
  await cancelRecognition();
  const task = generation;
  const root = new URL(`${import.meta.env.BASE_URL}ocr/`, location.origin).href;
  const worker = await createWorker('eng', 1, {
    workerPath: `${root}worker.min.js`, corePath: root, langPath: root,
    logger: message => { if (task === generation) progress(message.status === 'recognizing text' ? `Reading card · ${Math.round(message.progress * 100)}%` : 'Preparing on-device scanner…'); },
  });
  if (task !== generation) { await worker.terminate(); throw new Error('Scan cancelled.'); }
  active = worker;
  try {
    const source = await loadImage(image);
    const crop = (x: number, y: number, width: number, height: number) => {
      const canvas = document.createElement('canvas'); canvas.width = Math.round(source.width * width * 3); canvas.height = Math.round(source.height * height * 3);
      const ctx = canvas.getContext('2d')!; ctx.filter = 'grayscale(1) contrast(1.3)';
      ctx.drawImage(source, source.width * x, source.height * y, source.width * width, source.height * height, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    };
    // Avoid attack names and “evolves from” text competing with the card title.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const title = await worker.recognize(crop(.03, .02, .94, .075));
    if (task !== generation) throw new Error('Scan cancelled.');
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const footer = await worker.recognize(crop(.02, .90, .96, .085));
    return `${title.data.text}\n${footer.data.text}`;
  }
  finally { if (active === worker) active = undefined; await worker.terminate(); }
}
export async function imageFromFile(file: File): Promise<string> {
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose an image smaller than 25 MB.');
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo of your card.');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .92);
  } catch { throw new Error('This image could not be opened. Try a JPG, PNG, or a new camera capture.'); }
  finally { URL.revokeObjectURL(url); }
}
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
}
export async function rotateImage(url: string) {
  const image = await loadImage(url); const canvas = document.createElement('canvas');
  canvas.width = image.height; canvas.height = image.width;
  const ctx = canvas.getContext('2d')!; ctx.translate(canvas.width, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', .94);
}
