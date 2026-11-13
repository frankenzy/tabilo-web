import { describe, expect, it } from 'vitest';
import { occupiedFor, orderStateLabel, orderSummary, tableLook } from '@/components/pages/tables/tables-logic';

/** Spec 020 — fiche d'une table (specs/020-fiche-table/spec.md). */
describe('Spec 020 — fiche d’une table', () => {
  const now = Date.parse('2026-11-13T14:00:00Z');

  it('CA-020-01 — « occupée depuis » se lit d’un coup d’œil', () => {
    expect(occupiedFor('2026-11-13T12:35:00Z', now)).toBe('1 h 25');
    expect(occupiedFor('2026-11-13T13:52:00Z', now)).toBe('8 min');
    expect(occupiedFor('2026-11-13T13:59:40Z', now)).toBe('à l’instant');
  });

  it('CA-020-02, 03 — l’état de la table suit la demande la plus urgente, sinon libre ou occupée', () => {
    expect(tableLook('free', [], now).tone).toBe('free');
    expect(tableLook('occupied', [], now).label).toBe('Occupée');
    const late = { status: 'pending' as const, createdAt: '2026-11-13T13:40:00Z', dueAt: '2026-11-13T13:45:00Z', escalationStatus: 'none' as const };
    expect(tableLook('occupied', [late], now).tone).toBe('late');
  });

  it('CA-020-04 — une commande se résume en plats, articles et état', () => {
    expect(orderSummary([{ menuItemId: 'garba', quantity: 2 }, { menuItemId: 'bissap', quantity: 1 }])).toEqual({ dishes: 2, articles: 3 });
    expect(orderStateLabel('resolved').label).toBe('Servie');
    expect(orderStateLabel('in_progress').label).toBe('En préparation');
    expect(orderStateLabel('pending').label).toBe('Envoyée');
    expect(orderStateLabel('cancelled').tone).toBe('cancelled');
  });
});
