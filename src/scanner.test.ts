import { expect, it } from 'vitest';
import type { Page } from 'tesseract.js';
import { reliableText } from './scanner';

it('keeps confident title words on a low-confidence page without body or evolution names', () => {
  const page = { confidence: 20, blocks: [{ paragraphs: [{ lines: [
    { text: 'Gengar', bbox: { y1: 120 }, words: [{ text: 'Gengar', confidence: 90 }] },
    { text: 'Evolves from Haunter', bbox: { y1: 160 }, words: [{ text: 'Haunter', confidence: 95 }] },
    { text: 'Hala', bbox: { y1: 700 }, words: [{ text: 'Hala', confidence: 80 }] },
  ] }] }] } as unknown as Page;
  expect(reliableText(page, 400)).toBe('Gengar');
});
