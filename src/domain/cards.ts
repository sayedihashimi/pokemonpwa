export interface CardBrief { id: string; name: string; localId: string; image?: string }
export interface Card extends CardBrief {
  category?: string; rarity?: string; hp?: number; types?: string[]; illustrator?: string;
  set: { id: string; name: string; cardCount?: { official?: number } };
  variants?: Record<string, boolean>;
  pricing?: { tcgplayer?: Record<string, unknown> };
}
export interface Quote { cents: number | null; productId?: number; updated?: string; reason?: string }
export const variantLabels: Record<string, string> = {
  normal: 'Normal', holofoil: 'Holofoil', 'reverse-holofoil': 'Reverse holo',
  '1st-edition-holofoil': '1st edition · Holofoil', '1st-edition-normal': '1st edition · Normal',
};
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export function parseBrief(value: unknown): CardBrief | null {
  if (!record(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.localId !== 'string') return null;
  // TCG Pocket uses separate digital-only sets, not physical collectible cards.
  if (/^[AB]\d[a-z]?-/i.test(value.id)) return null;
  return { id: value.id, name: value.name, localId: value.localId,
    image: typeof value.image === 'string' && value.image.startsWith('https://assets.tcgdex.net/') ? value.image : undefined };
}
export function parseCard(value: unknown): Card {
  const brief = parseBrief(value);
  if (!brief || !record(value) || !record(value.set) || typeof value.set.id !== 'string' || typeof value.set.name !== 'string') throw new Error('The card provider returned incomplete card details. Please try another match.');
  return { ...brief, set: { id: value.set.id, name: value.set.name, cardCount: record(value.set.cardCount) ? { official: typeof value.set.cardCount.official === 'number' ? value.set.cardCount.official : undefined } : undefined },
    category: typeof value.category === 'string' ? value.category : undefined,
    rarity: typeof value.rarity === 'string' ? value.rarity : undefined,
    hp: typeof value.hp === 'number' ? value.hp : undefined,
    illustrator: typeof value.illustrator === 'string' ? value.illustrator : undefined,
    types: Array.isArray(value.types) ? value.types.filter((t): t is string => typeof t === 'string') : undefined,
    variants: record(value.variants) ? Object.fromEntries(Object.entries(value.variants).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean> : undefined,
    pricing: record(value.pricing) && record(value.pricing.tcgplayer) ? { tcgplayer: value.pricing.tcgplayer } : undefined,
  };
}
export function variantsFor(card: Card): string[] {
  const prices = card.pricing?.tcgplayer;
  const keys = prices ? Object.keys(prices).filter(k => record(prices[k])) : [];
  if (card.variants?.normal) keys.push('normal');
  if (card.variants?.holo) keys.push('holofoil');
  if (card.variants?.reverse) keys.push('reverse-holofoil');
  return [...new Set(keys)];
}
export function quoteFor(card: Card, variant: string, edition: string): Quote {
  if (!variant) return { cents: null, reason: 'Confirm the printing to see its price.' };
  if (card.variants?.firstEdition && edition !== 'unlimited') return { cents: null, reason: 'This feed does not verify a separate first-edition price. Check the exact edition on the marketplace.' };
  const prices = card.pricing?.tcgplayer;
  const entry = prices?.[variant];
  if (!prices || prices.unit !== 'USD' || !record(entry)) return { cents: null, reason: 'No USD market price is available for this printing.' };
  const amount = entry.marketPrice;
  const cents = typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(Math.round(amount * 100)) ? Math.round(amount * 100) : null;
  return { cents, productId: typeof entry.productId === 'number' && Number.isSafeInteger(entry.productId) && entry.productId > 0 ? entry.productId : undefined,
    updated: typeof prices.updated === 'string' && Number.isFinite(Date.parse(prices.updated)) ? prices.updated : undefined,
    reason: cents === null ? 'No market price is available for this printing.' : undefined };
}
export function soldSearch(card: Card, variant: string, grade: 9 | 10, edition = ''): string {
  const keywords = `${card.name} ${card.set.name} ${card.localId} ${variantLabels[variant] || variant} ${edition === 'first' ? '1st edition' : edition === 'unlimited' ? 'unlimited' : ''} PSA ${grade} -lot -bundle -CGC -BGS`;
  return `https://www.ebay.com/sch/i.html?${new URLSearchParams({ _nkw: keywords, LH_Sold: '1', LH_Complete: '1', _sop: '13' })}`;
}
export const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const normalizeNumber = (text: string) => normalize(text).replace(/^(\D*)0+(?=\d)/, '$1');

export function searchCatalog(catalog: CardBrief[], query: string, number = '', set = ''): CardBrief[] {
  const name = normalize(query); const num = normalizeNumber(number.split('/')[0]); const setId = normalize(set);
  if (!name && !num && !setId) return [];
  return catalog.filter(card => (!name || normalize(card.name).includes(name) || normalize(card.id).includes(name)) && (!num || normalizeNumber(card.localId) === num) && (!setId || normalize(card.id.slice(0, card.id.lastIndexOf('-'))).includes(setId)))
    .sort((a, b) => Number(normalize(b.name) === name) - Number(normalize(a.name) === name) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function matchText(catalog: CardBrief[], text: string): CardBrief[] {
  // Preserve line and word boundaries: merging all OCR text can turn unrelated
  // fragments ("Se" on one line, "er" on another) into a plausible card name.
  // Allow split words on a single line, e.g. Tesseract's "Kyo gre".
  const phrases = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    if (/evolves?\s+from/i.test(line)) continue;
    const words = line.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) || [];
    // Long attack/flavor descriptions are not card-title evidence.
    if (words.length > 12) continue;
    for (let start = 0; start < words.length; start++) {
      for (let end = start + 1; end <= Math.min(words.length, start + 4); end++) phrases.add(words.slice(start, end).join(''));
    }
  }
  const numbers = [...text.matchAll(/\b([A-Z]{0,4}\d{1,3})\s*\/\s*([A-Z]{0,4}\d{1,3})\b/gi)].map(m => normalizeNumber(m[1]));
  // When a collector number is readable, require name AND number. A shared
  // number alone is not evidence for an unrelated Pokémon or trainer card.
  return catalog.filter(card => normalize(card.name).length >= 3 && phrases.has(normalize(card.name))
    && (!numbers.length || numbers.includes(normalizeNumber(card.localId))))
    .sort((a, b) => normalize(b.name).length - normalize(a.name).length || a.id.localeCompare(b.id)).slice(0, 12);
}
