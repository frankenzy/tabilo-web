import type { MenuItem } from '@/contracts';

/** Recherche et filtre de disponibilité d'une rubrique. */
export interface ItemFilter {
  query: string;
  availability: 'all' | 'available' | 'soldout';
}

export const NO_ITEM_FILTER: ItemFilter = { query: '', availability: 'all' };

const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Articles d'une rubrique qui correspondent à la recherche (nom ou description, sans accents) et au filtre. */
export function filterItems<T extends Pick<MenuItem, 'name' | 'description' | 'isAvailable'>>(items: T[], filter: ItemFilter): T[] {
  const needle = fold(filter.query);
  return items.filter(
    (item) =>
      (filter.availability === 'all' || item.isAvailable === (filter.availability === 'available')) &&
      (!needle || fold(`${item.name} ${item.description ?? ''}`).includes(needle)),
  );
}
