import { describe, expect, it } from 'vitest';
import { cartLines, optionKey, optionsValid, orderableNow, parseCartKey, unitPrice } from '@/components/pages/guest/cart';
import { presetRange } from '@/components/pages/analytics/export-logic';
import type { MenuCategory, MenuItem } from '@/contracts';
import { isOpen, nextOpening } from '@/utils/slots';

/** Specs 038 à 040 — options, créneaux et périodes d'export (logique de l'interface). */

const TZ = 'Africa/Abidjan';
const poisson: MenuItem = {
  id: 'poisson', name: 'Poisson braisé', description: null, priceMinor: 3000, imageId: null, isAvailable: true, isBundle: false, groups: [],
  promoPriceMinor: null, promoSlots: null, promoName: null, availabilitySlots: null,
  optionGroups: [
    { id: 'taille', name: 'Taille', multiple: false, required: true, options: [
      { id: 'petit', name: 'Petit', priceMinor: 0, icon: null, isAvailable: true },
      { id: 'moyen', name: 'Moyen', priceMinor: 1000, icon: null, isAvailable: true },
    ] },
    { id: 'sup', name: 'Suppléments', multiple: true, required: false, options: [
      { id: 'oeuf', name: 'Œuf', priceMinor: 200, icon: null, isAvailable: true },
      { id: 'sauce', name: 'Sauce', priceMinor: 100, icon: null, isAvailable: false },
    ] },
  ],
};
const menu = (item: MenuItem): MenuCategory[] => [{ id: 'c', name: 'Grillades', icon: 'flame', imageId: null, items: [item] }];
const tuesday18h = new Date('2026-12-01T18:00:00Z');

describe('Specs 038 à 040', () => {
  it('CA-038-02 et CA-038-04 — prix avec suppléments, une ligne par combinaison', () => {
    const a = optionKey('poisson', ['oeuf', 'moyen']);
    expect(a).toBe(optionKey('poisson', ['moyen', 'oeuf']));
    expect(parseCartKey(a)).toEqual({ itemId: 'poisson', choiceIds: [], optionIds: ['moyen', 'oeuf'] });
    const { lines, totalMinor } = cartLines({ [a]: 1, [optionKey('poisson', ['petit'])]: 2 }, menu(poisson), tuesday18h, TZ);
    expect(lines.map((line) => line.unitMinor)).toEqual([4200, 3000]);
    expect(totalMinor).toBe(4200 + 6000);
  });

  it('CA-038-03 — options contrôlées (obligatoire, choix unique, indisponible)', () => {
    expect(optionsValid(poisson, ['petit'])).toBe(true);
    expect(optionsValid(poisson, ['oeuf'])).toBe(false);
    expect(optionsValid(poisson, ['petit', 'moyen'])).toBe(false);
    expect(optionsValid(poisson, ['petit', 'sauce'])).toBe(false);
  });

  it('CA-039-01 — promotion programmée : prix promo dans le créneau seulement', () => {
    const biere = { ...poisson, optionGroups: [], priceMinor: 700, promoPriceMinor: 500, promoSlots: [{ days: [1, 2, 3, 4, 5], start: '17:00', end: '19:00' }] };
    expect(unitPrice(biere, tuesday18h, TZ)).toBe(500);
    expect(unitPrice(biere, new Date('2026-12-01T19:05:00Z'), TZ)).toBe(700);
  });

  it('CA-039-03 — hors créneau, plat non commandable, prochaine ouverture affichée', () => {
    const midi = { ...poisson, optionGroups: [], availabilitySlots: [{ days: [1, 2, 3, 4, 5, 6, 7], start: '11:00', end: '15:00' }] };
    const at16h = new Date('2026-12-01T16:00:00Z');
    expect(orderableNow(midi, at16h, TZ)).toBe(false);
    expect(isOpen(midi.availabilitySlots, new Date('2026-12-01T12:00:00Z'), TZ)).toBe(true);
    expect(nextOpening(midi.availabilitySlots, at16h, TZ)).toBe('Mer 11 h');
    expect(cartLines({ poisson: 1 }, menu(midi), at16h, TZ).hasInvalid).toBe(true);
  });

  it('spec 040, R1 — périodes d’export', () => {
    const now = new Date(2026, 10, 26, 10); // jeudi 26 novembre 2026
    expect(presetRange('today', now)).toEqual({ from: '2026-11-26', to: '2026-11-26' });
    expect(presetRange('yesterday', now)).toEqual({ from: '2026-11-25', to: '2026-11-25' });
    expect(presetRange('week', now)).toEqual({ from: '2026-11-23', to: '2026-11-26' });
    expect(presetRange('month', now)).toEqual({ from: '2026-11-01', to: '2026-11-26' });
    expect(presetRange('previous_month', now)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });
});
