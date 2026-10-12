import Dexie, { type Table } from 'dexie';
import type { Card, CardBrief } from './domain/cards';
interface CachedCard { id: string; data: Card; fetchedAt: number }
interface Catalog { id: string; data: CardBrief[]; fetchedAt: number }
class AppDatabase extends Dexie {
  cards!: Table<CachedCard>; catalog!: Table<Catalog>;
  constructor() { super('goozemon'); this.version(1).stores({ cards: 'id, fetchedAt', catalog: 'id' }); }
}
export const db = new AppDatabase();
export async function clearCache() { await Promise.all([db.cards.clear(), db.catalog.clear()]); }
