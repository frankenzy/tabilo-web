import { describe, expect, it } from 'vitest';
import { filterItems } from '@/components/pages/menu/menu-filter';

const items = [
  { name: 'Attiéké poisson braisé', description: 'Carpe braisée, oignons', isAvailable: true },
  { name: 'Garba', description: 'Attiéké, thon frit, piment', isAvailable: false },
  { name: 'Alloco poulet', description: null, isAvailable: true },
];

describe('Menus — recherche et filtre par rubrique', () => {
  it('cherche dans le nom et la description, sans accents ni majuscules', () => {
    expect(filterItems(items, { query: 'attieke', availability: 'all' }).map((i) => i.name)).toEqual(['Attiéké poisson braisé', 'Garba']);
    expect(filterItems(items, { query: 'POULET', availability: 'all' }).map((i) => i.name)).toEqual(['Alloco poulet']);
  });

  it('filtre les disponibles ou les épuisés, combiné à la recherche', () => {
    expect(filterItems(items, { query: '', availability: 'soldout' }).map((i) => i.name)).toEqual(['Garba']);
    expect(filterItems(items, { query: 'attieke', availability: 'available' }).map((i) => i.name)).toEqual(['Attiéké poisson braisé']);
    expect(filterItems(items, { query: 'zzz', availability: 'all' })).toEqual([]);
  });
});
