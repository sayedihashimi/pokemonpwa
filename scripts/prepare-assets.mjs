import { mkdir, readdir, copyFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const path = (p) => new URL(p, root);
await mkdir(path('public/ocr'), { recursive: true });
await mkdir(path('public/notices'), { recursive: true });
await copyFile(path('node_modules/@fontsource/dm-sans/LICENSE'), path('public/notices/DM-SANS-LICENSE.txt'));
await copyFile(path('node_modules/@fontsource/manrope/LICENSE'), path('public/notices/MANROPE-LICENSE.txt'));
await copyFile(path('node_modules/@tesseract.js-data/eng/package.json'), path('public/notices/ENGLISH-OCR-PACKAGE.json'));
await copyFile(path('node_modules/tesseract.js/dist/worker.min.js'), path('public/ocr/worker.min.js'));
for (const file of await readdir(path('node_modules/tesseract.js-core'))) {
  if (/^tesseract-core.*lstm\.wasm(?:\.js)?$/.test(file)) await copyFile(path(`node_modules/tesseract.js-core/${file}`), path(`public/ocr/${file}`));
}
await copyFile(path('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'), path('public/ocr/eng.traineddata.gz'));
await copyFile(path('node_modules/tesseract.js/LICENSE.md'), path('public/ocr/TESSERACT-LICENSE.txt'));
await copyFile(path('node_modules/tesseract.js-core/LICENSE'), path('public/ocr/CORE-LICENSE.txt'));
const svg = await readFile(path('public/icon.svg'));
for (const size of [180, 192, 512]) await sharp(svg).resize(size, size).png().toFile(fileURLToPath(new URL(size === 180 ? 'public/apple-touch-icon.png' : `public/icon-${size}.png`, root)));
console.log('Prepared app icons and local OCR assets.');
