import { describe, expect, it } from 'vitest';
import { cartLines, unitPrice } from '@/components/pages/guest/cart';
import { guestRequestSchema, type MenuCategory, type MenuItem } from '@/contracts';

/** Spec 033 — bonus : prix promotionnel côté client, ligne offerte reçue du serveur. */

const item = (extra: Partial<MenuItem> = {}): MenuItem => ({
  id: 'poulet', name: 'Poulet braisé', description: null, priceMinor: 3500, imageId: null, isAvailable: true, isBundle: false, groups: [], promoPriceMinor: null, promoSlots: null, promoName: null, availabilitySlots: null, optionGroups: [], ...extra,
});
const menu = (extra: Partial<MenuItem> = {}): MenuCategory[] => [{ id: 'c', name: 'Grillades', icon: 'flame', imageId: null, items: [item(extra)] }];

describe('Spec 033 — bonus', () => {
  it('CA-033-01 — en promotion, le prix promo est le prix commandé', () => {
    expect(unitPrice(item({ promoPriceMinor: 3000 }))).toBe(3000);
    expect(unitPrice(item())).toBe(3500);
    // Un prix promo incohérent (supérieur) est ignoré.
    expect(unitPrice(item({ promoPriceMinor: 4000 }))).toBe(3500);
  });

  it('CA-033-02 — le panier compte le prix promo', () => {
    expect(cartLines({ poulet: 2 }, menu({ promoPriceMinor: 3000 })).totalMinor).toBe(6000);
    expect(cartLines({ poulet: 2 }, menu()).totalMinor).toBe(7000);
  });

  it('CA-033-03 — une ligne offerte arrive au téléphone avec sa date', () => {
    const parsed = guestRequestSchema.parse({
      id: 'r', status: 'in_progress', type: { id: 'o', label: 'Commande', icon: 'utensils', kind: 'order' },
      items: [{ menuItemId: 'coca', name: 'Coca', quantity: 1, unitPriceMinor: 500, offeredAt: '2026-11-26T10:00:00.000Z', listPriceMinor: null }],
      totalMinor: 0, quantity: null, handledBy: null, createdAt: '2026-11-26T09:00:00.000Z',
      acceptedAt: null, startedAt: null, resolvedAt: null, cancelledAt: null, paidAt: null, note: null,
    });
    expect(parsed.items[0].offeredAt).toBe('2026-11-26T10:00:00.000Z');
  });
});
