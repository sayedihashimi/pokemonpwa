import { matchRead, normalizeNumber, searchCatalog, type CardBrief } from './cards';
import type { ScanRead } from '../scanner';
export type CaptureKind = 'full' | 'name' | 'number' | 'stamp';
export type Area = { x: number; y: number; width: number; height: number };
export type Areas = Record<'name' | 'number' | 'stamp', Area>;
export const defaultAreas: Areas = {
  name: { x: 0, y: 0, width: 1, height: .4 },
  number: { x: 0, y: .6, width: 1, height: .4 },
  stamp: { x: .62, y: .32, width: .32, height: .25 },
};
export const captureLabels: Record<CaptureKind, string> = { full: 'Full card', name: 'Name close-up', number: 'Number close-up', stamp: 'Stamp close-up' };
export interface Capture { id: string; image: string; kind: CaptureKind; areas: Areas }
export interface CaptureReading { id: string; kind: CaptureKind; reading: ScanRead }
export function clampArea(area: Area): Area {
  const safe = (n: number, fallback: number) => Number.isFinite(n) ? n : fallback;
  const x = Math.max(0, Math.min(.95, safe(area.x, 0))), y = Math.max(0, Math.min(.95, safe(area.y, 0)));
  return { x, y, width: Math.max(.05, Math.min(1 - x, safe(area.width, 1))), height: Math.max(.05, Math.min(1 - y, safe(area.height, 1))) };
}
const fraction = /\b([A-Z]{0,4}\d{1,3})\s*\/\s*([A-Z]{0,4}\d{1,3})\b/gi;
const withoutNumbers = (text: string) => text.replace(fraction, '');
export function combineCaptures(catalog: CardBrief[], captures: CaptureReading[]) {
  let pool: CardBrief[] | undefined;
  let approximate = false, conflict = '';
  const numbers = new Set<string>(), totals = new Set<string>();
  for (const { kind, reading } of captures) {
    if (kind === 'stamp') continue;
    if (kind !== 'number') {
      const matched = matchRead(catalog, { ...reading, text: withoutNumbers(reading.nameText ?? reading.text), fallbackText: reading.fallbackText && withoutNumbers(reading.fallbackText) });
      if (matched.matches.length) {
        approximate ||= matched.approximate;
        pool = pool ? pool.filter(card => matched.matches.some(other => other.id === card.id)) : matched.matches;
        if (!pool.length) conflict = 'The names in these photos disagree. Remove the unrelated photo or retake it using the same card.';
      }
    }
    if (kind !== 'name' && !reading.approximate) {
      const text = reading.numberText ?? reading.text;
      const fractions = [...text.matchAll(fraction)];
      for (const match of fractions) { numbers.add(normalizeNumber(match[1])); totals.add(normalizeNumber(match[2])); }
      // A number-only close-up must contain a standalone printed number. Never
      // treat HP or attack damage in a full-card photo as a collector number.
      if (!fractions.length && kind === 'number') for (const line of text.split('\n')) {
        if (/^[A-Z]{0,4}\d{1,3}$/i.test(line.trim())) numbers.add(normalizeNumber(line.trim()));
      }
    }
  }
  if (numbers.size > 1 || totals.size > 1) conflict = 'The collector numbers disagree. Remove or retake the conflicting photo before choosing a card.';
  const nameFound = !!pool?.length;
  const number = [...numbers][0];
  const matches = number && pool ? searchCatalog(pool, '', number) : pool || [];
  if (nameFound && number && !matches.length) conflict = 'The name and collector number do not match the same catalog entry. Check the reading areas or retake a close-up.';
  return { matches: conflict ? [] : matches, nameFound, numberFound: !!number && !conflict && matches.length > 0, number, approximate, conflict };
}
export type CaptureMatch = ReturnType<typeof combineCaptures>;
