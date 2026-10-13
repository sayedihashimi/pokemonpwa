import { describe, expect, it } from 'vitest';
import { matchText, parseCard, quoteFor, searchCatalog, soldSearch, type Card } from './cards';

const card: Card = { id: 'swsh3-136', name: 'Furret', localId: '136', set: { id: 'swsh3', name: 'Darkness Ablaze' }, variants: { normal: true, reverse: true }, pricing: { tcgplayer: { unit: 'USD', updated: '2026-10-11T00:00:00Z', normal: { marketPrice: .27, productId: 219333 }, 'reverse-holofoil': { marketPrice: .43, productId: 219333 } } } };
describe('printing-specific market references', () => {
  it('never falls back from a missing printing to normal', () => { expect(quoteFor(card, 'holofoil', '').cents).toBeNull(); expect(quoteFor(card, 'reverse-holofoil', '').cents).toBe(43); });
  it('keeps missing values distinct from a legitimate zero', () => {
    const priced = (marketPrice: unknown) => ({ ...card, pricing: { tcgplayer: { unit: 'USD', normal: { marketPrice } } } });
    for (const value of [null, undefined, NaN, Infinity, -1, '1.25']) expect(quoteFor(priced(value), 'normal', '').cents).toBeNull();
    expect(quoteFor(priced(0), 'normal', '').cents).toBe(0);
  });
  it('withholds an unverified first-edition price', () => { expect(quoteFor({ ...card, variants: { firstEdition: true } }, 'normal', 'first').cents).toBeNull(); });
  it('rejects wrong currency', () => { expect(quoteFor({ ...card, pricing: { tcgplayer: { unit: 'EUR', normal: { marketPrice: 10 } } } }, 'normal', '').cents).toBeNull(); });
  it('withholds original-printing prices and product links for a stamped reprint', () => {
    const quote = quoteFor(card, 'stamped', '');
    expect(quote.cents).toBeNull(); expect(quote.productId).toBeUndefined();
    expect(quote.reason).toContain('stamped reprint');
  });
  it('rejects incomplete card details', () => { expect(() => parseCard({ id: 'x' })).toThrow(); });
  it('keeps grade and exact identity in sold-search URLs', () => { const url = new URL(soldSearch(card, 'reverse-holofoil', 10)); expect(url.searchParams.get('_nkw')).toContain('Furret Darkness Ablaze 136 Reverse holo'); expect(url.searchParams.get('_nkw')).toContain('PSA 10'); expect(url.searchParams.get('LH_Sold')).toBe('1'); });
});
describe('identity matching', () => {
  const cards = [card, { ...card, id: 'other-9', localId: '9' }, { id: 'promo-SV001', name: 'Pikachu', localId: 'SV001' }];
  it('ranks number plus name above repeated artwork/name', () => { expect(matchText(cards, 'Furret HP 110 136/189')[0].id).toBe(card.id); });
  it('preserves promo prefixes and tolerates leading zeros', () => { expect(searchCatalog(cards, '', 'SV1')[0].id).toBe('promo-SV001'); expect(searchCatalog(cards, 'Furret', '0136/189')[0].id).toBe(card.id); });
  it('does not invent a match for unreadable text', () => { expect(matchText(cards, 'zzzzz')).toEqual([]); });
  it('keeps printings beyond the first page when the number is unreadable', () => {
    const gengar = { id: 'swsh6-57', name: 'Gengar', localId: '57' };
    const catalog = [...Array.from({ length: 24 }, (_, i) => ({ id: `older-${i}`, name: 'Gengar', localId: `${i + 1}` })), gengar];
    const matches = matchText(catalog, 'Gengar\nLast Gift');
    expect(matches).toHaveLength(25); expect(matches).toContainEqual(gengar);
    expect(searchCatalog(matches, '', '057')).toEqual([gengar]);
  });
  const kyogre = { id: 'cel25-3', name: 'Kyogre', localId: '3' };
  const photoCatalog = [kyogre, { ...kyogre, id: 'ex9-6', localId: '6' }, { id: 'ecard2-133', name: 'Seer', localId: '133' }, { id: 'base1-3', name: 'Chansey', localId: '3' }];
  it('matches split OCR names and padded collector numbers together', () => {
    expect(matchText(photoCatalog, 'BASIC, Kyo gre\nw 130\nE(E) 003/025 *')).toEqual([kyogre]);
  });
  it('never constructs Seer from unrelated lines or a substring', () => {
    expect(matchText(photoCatalog, 'Se\ner\nseerandomnoise')).toEqual([]);
  });
  it('does not suggest an unrelated card just because its number matches', () => {
    expect(matchText(photoCatalog, 'unreadable title\n003/025')).toEqual([]);
    expect(matchText(photoCatalog, 'Kyogre\n133/144')).toEqual([]);
  });
  it('excludes the evolves-from name in a full-photo reading', () => {
    expect(matchText([...cards, { id: 'other-136', name: 'Sentret', localId: '136' }], 'Furret\nEvolves from Sentret\n136/189')).toEqual([card]);
  });
  it('uses a conservative long-name fallback without confusing X and Y or accepting short noise', () => {
    const mega = { id: 'me02-130', name: 'Mega Charizard X ex', localId: '130' };
    const candidates = [mega, { ...mega, id: 'y-130', name: 'Mega Charizard Y ex' }, { id: 'sm2-126', name: 'Hala', localId: '126' }, { id: 'base1-4', name: 'Charizard', localId: '4' }];
    expect(matchText(candidates, 'Mega CharirardX\nCharizard\nHala', true)).toEqual([mega]);
    expect(matchText(candidates, 'Hala', true)).toEqual([]);
    expect(matchText(candidates, 'Mega Charizard X ex 013/094', true)).toEqual([]);
  });
});
