import { describe, expect, it } from 'vitest';
import { inSpotlight, mergeIntoCart, reorderLines, servedTotal, SERVED_SPOTLIGHT_MS, spotlightStart, unpaidTotal } from '@/components/pages/guest/order-logic';

/** Spec 018 — commande servie (specs/018-commande-servie/spec.md). */
describe('Spec 018 — commande servie', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');

  it('CA-018-01 — vue passer au service : la minute part maintenant', () => {
    expect(spotlightStart('in_progress', { status: 'resolved', resolvedAt: '2026-11-13T11:58:00Z' }, now)).toBe(now);
    expect(spotlightStart(undefined, { status: 'in_progress', resolvedAt: null }, now)).toBeNull();
  });

  it('CA-018-02 — déjà servie au chargement : la minute part de l’heure de service, pas du rechargement', () => {
    const start = spotlightStart(undefined, { status: 'resolved', resolvedAt: '2026-11-13T11:58:00Z' }, now);
    expect(inSpotlight(start, now)).toBe(false);
    const recent = spotlightStart(undefined, { status: 'resolved', resolvedAt: '2026-11-13T11:59:30Z' }, now);
    expect(inSpotlight(recent, now)).toBe(true);
    expect(inSpotlight(now, now + SERVED_SPOTLIGHT_MS)).toBe(false);
  });

  it('CA-018-04 — Recommander ajoute les quantités au panier et ignore les plats retirés', () => {
    const menu = [{ items: [{ id: 'garba', isAvailable: true }, { id: 'bissap', isAvailable: true }, { id: 'alloco', isAvailable: false }] }];
    const order = {
      items: [
        { menuItemId: 'garba', name: 'Garba', quantity: 2, unitPriceMinor: 1500 },
        { menuItemId: 'bissap', name: 'Bissap', quantity: 1, unitPriceMinor: 500 },
        { menuItemId: 'alloco', name: 'Alloco', quantity: 1, unitPriceMinor: 1000 },
        { menuItemId: 'retire', name: 'Ancien plat', quantity: 1, unitPriceMinor: 900 },
        { name: 'Sans identifiant', quantity: 1, unitPriceMinor: 900 },
      ],
    };
    const lines = reorderLines(order, menu);
    expect(lines).toEqual([{ itemId: 'garba', quantity: 2 }, { itemId: 'bissap', quantity: 1 }]);
    expect(mergeIntoCart({ bissap: 1 }, lines)).toEqual({ bissap: 2, garba: 2 });
  });

  it('CA-018-05 — total servi : 5 000 + 7 500 ; l’annulée et la demande de service n’y entrent pas', () => {
    const order = { kind: 'order' as const, id: 'c', label: 'Commande', icon: 'utensils' };
    const water = { kind: 'service' as const, id: 'e', label: 'Eau', icon: 'droplet' };
    expect(
      servedTotal([
        { status: 'resolved', totalMinor: 5000, type: order },
        { status: 'resolved', totalMinor: 7500, type: order },
        { status: 'cancelled', totalMinor: 3000, type: order },
        { status: 'in_progress', totalMinor: 2000, type: order },
        { status: 'resolved', totalMinor: null, type: water },
      ]),
    ).toBe(12_500);
  });

  it('CA-026-07 — reste à régler : seulement les commandes servies et non réglées', () => {
    const order = { kind: 'order' as const, id: 'c', label: 'Commande', icon: 'utensils' };
    expect(
      unpaidTotal([
        { status: 'resolved', totalMinor: 5000, type: order, paidAt: '2026-11-17T12:00:00Z' },
        { status: 'resolved', totalMinor: 2000, type: order, paidAt: null },
        { status: 'in_progress', totalMinor: 1500, type: order, paidAt: null },
        { status: 'cancelled', totalMinor: 3000, type: order, paidAt: null },
      ]),
    ).toBe(2000);
  });
});
