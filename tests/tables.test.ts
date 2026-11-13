import { describe, expect, it } from 'vitest';
import { visibleNav } from '@/components/layouts/navigation';
import { areasOf, filterTables, tableCounts, tableLook, tableSize, TONE_BADGE } from '@/components/pages/tables/tables-logic';
import { URGENCY_TILE } from '@/utils/urgency';
import type { TableStatusView } from '@/contracts';

const table = (label: string, status: TableStatusView['status'], areaId: string, seats = 4): TableStatusView => ({
  id: label,
  label,
  seats,
  areaId,
  areaName: areaId === 'terrasse' ? 'Terrasse' : 'Salle',
  status,
  amountMinor: status === 'occupied' ? 1500 : null,
});

const TABLES = [
  table('1', 'occupied', 'salle'),
  table('2', 'free', 'salle'),
  table('T1', 'free', 'terrasse'),
  table('T2', 'occupied', 'terrasse'),
  table('T3', 'free', 'terrasse'),
];

describe('Spec 006 — vue des tables', () => {
  it('CA-006-01 — l’entrée « Tables » apparaît pour le gérant et le propriétaire, pas pour le serveur', () => {
    const waiter = ['floor.read', 'sessions.manage', 'requests.read', 'requests.create', 'requests.handle', 'staff.read'];
    expect(visibleNav(waiter).map((item) => item.label)).not.toContain('Tables');
    expect(visibleNav([...waiter, 'analytics.read']).map((item) => item.label)).toContain('Tables');
  });

  it('CA-006-06 — la taille découle du nombre de couverts', () => {
    expect([2, 4, 5, 6, 7, 8].map(tableSize)).toEqual(['Petite', 'Petite', 'Moyenne', 'Moyenne', 'Grande', 'Grande']);
  });

  it('CA-006-07 — les compteurs portent sur toutes les tables', () => {
    expect(tableCounts(TABLES)).toEqual({ occupied: 2, free: 3, total: 5 });
  });

  it('CA-006-08 — zone et état se combinent avec la recherche', () => {
    const terraceFree = filterTables(TABLES, { query: '', status: 'free', areaId: 'terrasse' });
    expect(terraceFree.map((t) => t.label)).toEqual(['T1', 'T3']);
    expect(filterTables(TABLES, { query: 't3', status: 'all', areaId: 'all' }).map((t) => t.label)).toEqual(['T3']);
    expect(filterTables(TABLES, { query: 'zzz', status: 'all', areaId: 'all' })).toEqual([]);
    expect(filterTables([table('Étage 1', 'free', 'salle')], { query: 'etage', status: 'all', areaId: 'all' })).toHaveLength(1);
  });

  it('CA-006-08 — le filtre de zone liste les zones dans l’ordre', () => {
    expect(areasOf(TABLES)).toEqual([
      { id: 'salle', name: 'Salle' },
      { id: 'terrasse', name: 'Terrasse' },
    ]);
  });

  const T0 = Date.parse('2026-11-12T12:00:00Z');
  const request = (status: string, ageSeconds: number, escalationStatus = 'none') => ({
    status,
    createdAt: new Date(T0 - ageSeconds * 1000).toISOString(),
    dueAt: new Date(T0 - ageSeconds * 1000 + 180_000).toISOString(),
    escalationStatus,
  }) as Parameters<typeof tableLook>[1][number];

  it('CA-006-10 — une demande en retard rend la table rouge, une demande acceptée la rend bleue, comme au tableau de bord', () => {
    const late = tableLook('occupied', [request('pending', 240)], T0);
    expect(late).toMatchObject({ tone: 'late', label: 'En retard' });
    expect(TONE_BADGE[late.tone]).toBe(URGENCY_TILE.late);
    const taken = tableLook('occupied', [request('accepted', 240)], T0);
    expect(taken).toMatchObject({ tone: 'progress', label: 'Prise en charge' });
    expect(TONE_BADGE[taken.tone]).toBe(URGENCY_TILE.progress);
  });

  it('CA-006-10 — la demande la plus urgente l’emporte, la plus ancienne donne le chronomètre', () => {
    const look = tableLook('occupied', [request('accepted', 600), request('pending', 10), request('assigned', 120, 'escalated')], T0);
    expect(look.tone).toBe('waiting');
    expect(look.escalated).toBe(true);
    expect(look.oldestCreatedAt).toBe(new Date(T0 - 600_000).toISOString());
  });

  it('CA-006-11 — sans demande, la table redevient occupée (orange) ou libre (vert)', () => {
    expect(tableLook('occupied', [], T0)).toMatchObject({ tone: 'occupied', label: 'Occupée', oldestCreatedAt: null });
    expect(tableLook('free', [], T0)).toMatchObject({ tone: 'free', label: 'Libre' });
    expect(tableLook('occupied', [request('pending', 10)], T0)).toMatchObject({ tone: 'calm', label: 'Nouvelle' });
  });
});
