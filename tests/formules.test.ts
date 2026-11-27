import { describe, expect, it } from 'vitest';
import { bundleKey, cartLines, parseCartKey, quantityOf } from '@/components/pages/guest/cart';
import { reorderLines } from '@/components/pages/guest/order-logic';
import { bundleGroupsError } from '@/components/pages/menu/bundle-logic';
import type { GuestRequest, MenuCategory, MenuItem } from '@/contracts';

/** Spec 032 — formules : composition dans le panier, contrôles et recommande. */

const dish = (id: string, extra: Partial<MenuItem> = {}): MenuItem => ({
  id, name: id, description: null, priceMinor: 1000, imageId: null, isAvailable: true, isBundle: false, groups: [], promoPriceMinor: null, promoSlots: null, promoName: null, availabilitySlots: null, optionGroups: [], ...extra,
});
const BUNDLE = dish('menu-midi', {
  name: 'Menu midi',
  priceMinor: 2500,
  isBundle: true,
  groups: [
    { id: 'g-plat', name: 'Plat', choiceIds: ['garba', 'alloco'] },
    { id: 'g-boisson', name: 'Boisson', choiceIds: ['coca', 'bissap'] },
  ],
});
const menu = (overrides: Partial<Record<string, Partial<MenuItem>>> = {}): MenuCategory[] => [
  {
    id: 'c', name: 'Midi', icon: 'utensils', imageId: null,
    items: [BUNDLE, ...['garba', 'alloco', 'coca', 'bissap'].map((id) => dish(id, overrides[id]))],
  },
];

describe('Spec 032 — formules', () => {
  it('CA-032-03 — une composition, une ligne ; prix de la formule seul', () => {
    const key = bundleKey('menu-midi', ['garba', 'coca']);
    expect(parseCartKey(key)).toEqual({ itemId: 'menu-midi', choiceIds: ['garba', 'coca'], optionIds: [] });
    const cart = { [key]: 2, [bundleKey('menu-midi', ['alloco', 'bissap'])]: 1, garba: 1 };
    const { lines, totalMinor, count } = cartLines(cart, menu());
    expect(totalMinor).toBe(3 * 2500 + 1000);
    expect(count).toBe(4);
    expect(lines[0].choices.map((choice) => choice.item?.id)).toEqual(['garba', 'coca']);
    expect(quantityOf(cart, 'menu-midi')).toBe(3);
  });

  it('CA-032-04 et CA-032-05 — composition incomplète, hors rubrique ou plat en rupture : ligne refusée', () => {
    expect(cartLines({ [bundleKey('menu-midi', ['garba'])]: 1 }, menu()).hasInvalid).toBe(true);
    expect(cartLines({ [bundleKey('menu-midi', ['coca', 'garba'])]: 1 }, menu()).hasInvalid).toBe(true);
    expect(cartLines({ [bundleKey('menu-midi', ['garba', 'coca'])]: 1 }, menu({ coca: { isAvailable: false } })).hasInvalid).toBe(true);
  });

  it('recommander une formule garde sa composition', () => {
    const request = {
      items: [{ menuItemId: 'menu-midi', name: 'Menu midi', quantity: 1, unitPriceMinor: 2500, choices: [
        { group: 'Plat', menuItemId: 'garba', name: 'garba' },
        { group: 'Boisson', menuItemId: 'coca', name: 'coca' },
      ] }],
    } as Pick<GuestRequest, 'items'>;
    expect(reorderLines(request, menu())).toEqual([{ itemId: bundleKey('menu-midi', ['garba', 'coca']), quantity: 1 }]);
    expect(reorderLines(request, menu({ coca: { isAvailable: false } }))).toEqual([]);
  });

  it('CA-032-01 — rubriques : un nom et au moins un plat chacune', () => {
    expect(bundleGroupsError([{ key: 'a', name: 'Plat', choiceIds: ['garba'] }])).toBeNull();
    expect(bundleGroupsError([{ key: 'a', name: ' ', choiceIds: ['garba'] }])).toMatch(/nom/);
    expect(bundleGroupsError([{ key: 'a', name: 'Boisson', choiceIds: [] }])).toMatch(/Boisson/);
    expect(bundleGroupsError([])).toMatch(/1 à 4/);
  });
});
