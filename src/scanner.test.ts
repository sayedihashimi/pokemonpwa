import { expect, it } from 'vitest';
import type { Page } from 'tesseract.js';
import { reliableText, titleFragments } from './scanner';
import { matchText } from './domain/cards';

it('keeps confident title words on a low-confidence page without body or evolution names', () => {
  const page = { confidence: 20, blocks: [{ paragraphs: [{ lines: [
    { text: 'Gengar', bbox: { y1: 120 }, words: [{ text: 'Gengar', confidence: 90 }] },
    { text: 'from Haunter', bbox: { y1: 160 }, words: [{ text: 'Haunter', confidence: 95 }] },
    { text: 'Hala', bbox: { y1: 700 }, words: [{ text: 'Hala', confidence: 80 }] },
  ] }] }] } as unknown as Page;
  expect(reliableText(page, 400)).toBe('Gengar');
});

const fragments = (items: { text: string; x: number; y: number; width: number; confidence?: number }[]) => ({ blocks: items.map(item => ({ paragraphs: [{ lines: [{ text: item.text, words: [{ text: item.text, confidence: item.confidence ?? 90, bbox: { x0: item.x, x1: item.x + item.width, y0: item.y, y1: item.y + 30 } }] }] }] })) } as unknown as Page);
const gengar = { id: 'swsh6-57', name: 'Gengar', localId: '57' };

it('recovers Geng + ar in spatial order even when sparse OCR returns ar first', () => {
  const page = fragments([{ text: 'ar', x: 173, y: 102, width: 30 }, { text: 'Geng', x: 100, y: 100, width: 70 }]);
  expect(titleFragments(page, 400)).toBe('Geng ar');
  expect(matchText([gengar], titleFragments(page, 400))).toEqual([gengar]);
  expect(matchText([gengar], 'ar\nGeng')).toEqual([]);
});
it('does not join different rows, distant fragments, low-confidence words, or body text', () => {
  for (const change of [{ y: 150 }, { x: 260 }, { confidence: 59 }]) {
    expect(titleFragments(fragments([{ text: 'Geng', x: 100, y: 100, width: 70 }, { text: 'ar', x: 173, y: 100, width: 30, ...change }]), 400)).toBe('');
  }
  expect(titleFragments(fragments([{ text: 'Geng', x: 100, y: 600, width: 70 }, { text: 'ar', x: 173, y: 600, width: 30 }]), 400)).toBe('');
  expect(titleFragments(fragments([{ text: 'Se', x: 100, y: 100, width: 30 }, { text: 'er', x: 100, y: 300, width: 30 }]), 400)).toBe('');
});
it('recovers other split titles without a Pokemon-specific substitution', () => {
  expect(titleFragments(fragments([{ text: 'Pika', x: 100, y: 100, width: 60 }, { text: 'chu', x: 162, y: 101, width: 45 }]), 400)).toBe('Pika chu');
});
