import { describe, expect, it } from 'vitest';
import { clampArea, combineCaptures, type CaptureReading } from './captures';
const catalog = [{ id: 'swsh6-57', name: 'Gengar', localId: '57' }, { id: 'other-94', name: 'Gengar', localId: '94' }, { id: 'cel25-3', name: 'Kyogre', localId: '3' }];
const read = (kind: CaptureReading['kind'], text: string): CaptureReading => ({ id: crypto.randomUUID(), kind, reading: { text, approximate: false } });
describe('evidence from photos of one card', () => {
  it('combines a name with a separate native-resolution number close-up', () => {
    const result = combineCaptures(catalog, [read('full', 'Gengar'), read('number', '057/198')]);
    expect(result.matches.map(c => c.id)).toEqual(['swsh6-57']); expect(result.numberFound).toBe(true);
  });
  it('keeps the readable photo when another is unreadable', () => {
    expect(combineCaptures(catalog, [read('full', 'Gengar'), read('name', '???')]).matches).toHaveLength(2);
  });
  it('does not identify a card from a number alone or from stamp text', () => {
    expect(combineCaptures(catalog, [read('number', '057/198'), read('stamp', 'Gengar')]).matches).toEqual([]);
  });
  it('rejects different names, different numbers, and mismatched set totals', () => {
    for (const photos of [[read('full', 'Gengar'), read('full', 'Kyogre')], [read('full', 'Gengar 057/198'), read('number', '094/198')], [read('full', 'Gengar 057/198'), read('number', '057/165')], [read('full', 'Gengar'), read('number', '003/025')]]) {
      const result = combineCaptures(catalog, photos); expect(result.matches).toEqual([]); expect(result.conflict).not.toBe('');
    }
  });
  it('accepts a standalone number only in a number close-up, not HP on a full card', () => {
    expect(combineCaptures(catalog, [read('full', 'Gengar\n57')]).matches).toHaveLength(2);
    expect(combineCaptures(catalog, [read('full', 'Gengar'), read('number', '057')]).matches).toHaveLength(1);
  });
  it('uses selected-region evidence instead of unrelated whole-image text', () => {
    const result = combineCaptures(catalog, [{ ...read('full', 'Kyogre 003/025'), reading: { text: 'Kyogre 003/025', nameText: 'Gengar', numberText: '057/198', approximate: false } }]);
    expect(result.matches.map(c => c.id)).toEqual(['swsh6-57']);
  });
});
it('keeps adjustable crop coordinates inside the original image', () => {
  expect(clampArea({ x: -.3, y: .99, width: 2, height: 2 })).toEqual({ x: 0, y: .95, width: 1, height: .050000000000000044 });
  const area = clampArea({ x: NaN, y: 0, width: 0, height: Infinity });
  expect(area.x).toBe(0); expect(area.width).toBe(.05); expect(area.height).toBe(1);
});
