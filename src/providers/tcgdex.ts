import { parseBrief, parseCard, type Card, type CardBrief } from '../domain/cards';
import { db } from '../storage';
const API = 'https://api.tcgdex.net/v2/en';
let memoryCatalog: CardBrief[] | undefined;
let catalogRequest: Promise<CardBrief[]> | undefined;
async function getJson(path: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(20_000);
  const response = await fetch(`${API}/${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(response.status === 429 ? 'The card provider is busy. Please wait a moment and try again.' : 'Card data is temporarily unavailable. Please try again.');
  return response.json() as Promise<unknown>;
}
export async function getCatalog(): Promise<CardBrief[]> {
  if (memoryCatalog) return memoryCatalog;
  if (catalogRequest) return catalogRequest;
  catalogRequest = (async () => {
    const cached = await db.catalog.get('en').catch(() => undefined);
    if (cached && Date.now() - cached.fetchedAt < 86400_000) return memoryCatalog = cached.data;
    try {
      const raw = await getJson('cards');
      if (!Array.isArray(raw)) throw new Error('The catalog response could not be read.');
      const cards = raw.map(parseBrief).filter((c): c is CardBrief => c !== null);
      if (cards.length < 100) throw new Error('The catalog response was incomplete.');
      await db.catalog.put({ id: 'en', data: cards, fetchedAt: Date.now() }).catch(() => undefined);
      return memoryCatalog = cards;
    } catch (error) { if (cached) return memoryCatalog = cached.data; throw error; }
  })();
  try { return await catalogRequest; } finally { catalogRequest = undefined; }
}
export function resetCatalogMemory() { memoryCatalog = undefined; }
export async function getCard(id: string, signal?: AbortSignal, force = false): Promise<{ card: Card; fetchedAt: number; cached: boolean; refreshFailed?: boolean }> {
  const cached = await db.cards.get(id).catch(() => undefined);
  if (!force && cached && Date.now() - cached.fetchedAt < 3600_000) return { card: cached.data, fetchedAt: cached.fetchedAt, cached: true };
  try {
    const card = parseCard(await getJson(`cards/${encodeURIComponent(id)}`, signal));
    if (card.id !== id) throw new Error('The provider returned a different card. Please try again.');
    const fetchedAt = Date.now();
    await db.cards.put({ id, data: card, fetchedAt }).then(async () => {
      const extra = await db.cards.count() - 200;
      if (extra > 0) { const keys = await db.cards.orderBy('fetchedAt').limit(extra).primaryKeys(); await db.cards.bulkDelete(keys); }
    }).catch(() => undefined);
    return { card, fetchedAt, cached: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (cached) return { card: cached.data, fetchedAt: cached.fetchedAt, cached: true, refreshFailed: true };
    throw error;
  }
}
