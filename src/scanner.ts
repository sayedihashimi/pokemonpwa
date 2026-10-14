import { createWorker, PSM, type Worker, type Page } from 'tesseract.js';
import { clampArea, defaultAreas, type Areas, type CaptureKind } from './domain/captures';
export interface ScanRead { text: string; approximate: boolean; fallbackText?: string; nameText?: string; numberText?: string }
export function reliableText(page: Pick<Page, 'blocks'>, maxY = Infinity): string {
  return (page.blocks || []).flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines.filter(line => line.bbox.y1 <= maxY && !/\bfrom\b/i.test(line.text)).map(line =>
    line.words.map(word => word.confidence >= 60 ? word.text : '\n').join(' ')))).join('\n');
}
// Sparse OCR sometimes puts adjacent pieces of one title into separate blocks,
// even in reverse reading order. Rejoin only confident, closely spaced words
// that occupy the same visual row; never concatenate arbitrary OCR lines.
export function titleFragments(page: Pick<Page, 'blocks'>, maxY: number): string {
  const words = (page.blocks || []).flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines
    .filter(line => !/\bfrom\b/i.test(line.text))
    .flatMap(line => line.words)))
    .filter(word => word.confidence >= 60 && /^[a-z]{2,}$/i.test(word.text) && word.bbox.y1 <= maxY)
    .sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const phrases: string[] = [];
  for (const first of words) {
    const parts = [first.text]; let previous = first;
    for (const next of words) {
      const a = previous.bbox, b = next.bbox;
      const height = Math.min(a.y1 - a.y0, b.y1 - b.y0);
      const overlap = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      const gap = b.x0 - a.x1;
      if (height <= 0 || b.x0 <= a.x0 || overlap < height * .65 || gap < -height * .1 || gap > height * .6) continue;
      parts.push(next.text); previous = next;
      phrases.push(parts.join(' '));
      if (parts.length === 6) break;
    }
  }
  return [...new Set(phrases)].join('\n');
}
let active: Worker | undefined;
let generation = 0;
export async function cancelRecognition() { generation++; const worker = active; active = undefined; await worker?.terminate(); }
export async function recognize(image: string, progress: (value: string) => void, kind: CaptureKind = 'full', areas: Areas = defaultAreas): Promise<ScanRead> {
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
      const canvas = document.createElement('canvas'); canvas.width = Math.round(source.width * width); canvas.height = Math.round(source.height * height);
      if (canvas.width * canvas.height > 16_000_000) throw new Error('This reading area is too large to process on a phone. Adjust it to cover just the printed detail, then scan again.');
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(source, source.width * x, source.height * y, source.width * width, source.height * height, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/png'); canvas.width = canvas.height = 0; return data;
    };
    if (kind !== 'full') {
      if (kind === 'stamp') return { text: '', approximate: false };
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const area = clampArea(areas[kind]);
      const detail = await worker.recognize(crop(area.x, area.y, area.width, area.height), {}, { blocks: true });
      if (task !== generation) throw new Error('Scan cancelled.');
      const text = reliableText(detail.data);
      const nameText = `${text}\n${titleFragments(detail.data, source.height * area.height)}`;
      return { text: kind === 'name' ? nameText : text, approximate: false, nameText: kind === 'name' ? nameText : '', numberText: kind === 'number' ? text : '' };
    }
    // The original is retained. Only the broad context pass uses a smaller copy;
    // title and collector-number crops below read the original pixels at 1:1.
    const overviewCanvas = document.createElement('canvas');
    const overviewScale = Math.min(1, 1800 / Math.max(source.width, source.height));
    overviewCanvas.width = Math.round(source.width * overviewScale); overviewCanvas.height = Math.round(source.height * overviewScale);
    overviewCanvas.getContext('2d')!.drawImage(source, 0, 0, overviewCanvas.width, overviewCanvas.height);
    const overview = overviewCanvas.toDataURL('image/jpeg', .92);
    const overviewImage = await loadImage(overview);
    overviewCanvas.width = overviewCanvas.height = 0;
    // Uploaded photos can include a sleeve and background. Locate text across the
    // photo instead of assuming its top edge is the card's title strip.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const whole = await worker.recognize(overview, {}, { blocks: true });
    if (task !== generation) throw new Error('Scan cancelled.');
    // The lower region includes the collector number even when the card is
    // inset. Native pixels preserve small type; filtering can erase foil text.
    const numberArea = clampArea(areas.number), nameArea = clampArea(areas.name);
    const footer = await worker.recognize(crop(numberArea.x, numberArea.y, numberArea.width, numberArea.height), {}, { blocks: true });
    if (task !== generation) throw new Error('Scan cancelled.');
    // Read the title directly from the original, separately from artwork and body text.
    const title = await worker.recognize(crop(nameArea.x, nameArea.y, nameArea.width, nameArea.height), {}, { blocks: true });
    if (task !== generation) throw new Error('Scan cancelled.');
    const customName = JSON.stringify(nameArea) !== JSON.stringify(defaultAreas.name);
    const customNumber = JSON.stringify(numberArea) !== JSON.stringify(defaultAreas.number);
    const titleText = `${reliableText(title.data)}\n${titleFragments(title.data, source.height * nameArea.height)}\n${customName ? '' : titleFragments(whole.data, overviewImage.height * .4)}`;
    const text = `${titleText}\n${reliableText(whole.data)}\n${reliableText(footer.data)}`;
    const numberText = `${reliableText(footer.data)}\n${customNumber ? '' : reliableText(whole.data)}`;
    const nameText = `${titleText}\n${customName ? '' : reliableText(whole.data)}`;
    if (whole.data.confidence >= 45 || /\b\d{1,3}\s*\/\s*\d{1,3}\b/.test(text)) return { text, approximate: false, nameText, numberText };
    progress('Trying a clearer reading of reflective text…');
    // Red-channel binarization removes some gold/foil texture. Keep this as an
    // explicitly approximate fallback; never blend its noise into exact OCR.
    const canvas = document.createElement('canvas'); canvas.width = overviewImage.width; canvas.height = overviewImage.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(overviewImage, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const value = pixels.data[i] > 140 ? 255 : 0;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    }
    ctx.putImageData(pixels, 0, 0);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const fallback = await worker.recognize(canvas.toDataURL('image/png'));
    if (task !== generation) throw new Error('Scan cancelled.');
    // Preserve high-confidence title evidence even if the page as a whole
    // scored poorly. Keep noisy body text out of the exact fallback matches.
    const reliableTitle = `${titleText}\n${customName ? '' : reliableText(whole.data, overviewImage.height * .4)}`;
    return { text: reliableTitle, nameText: reliableTitle, numberText, fallbackText: customName ? undefined : fallback.data.text, approximate: false };
  }
  finally { if (active === worker) active = undefined; await worker.terminate(); }
}
export async function imageFromFile(file: File): Promise<string> {
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose an image smaller than 25 MB.');
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo of your card.');
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string); reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    await loadImage(url); // Verify decoding without resizing or recompressing the upload.
    return url;
  } catch { throw new Error('This image could not be opened. Try a JPG, PNG, or a new camera capture.'); }

}
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
}
export async function rotateImage(url: string) {
  const image = await loadImage(url); const canvas = document.createElement('canvas');
  canvas.width = image.height; canvas.height = image.width;
  const ctx = canvas.getContext('2d')!; ctx.translate(canvas.width, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}
