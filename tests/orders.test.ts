import { describe, expect, it } from 'vitest';
import { visibleNav } from '@/components/layouts/navigation';
import { capabilitiesOf } from '@/components/pages/requests/capabilities';
import { columnsFor, dishImages, filterOrders, groupOrders, hasFilters, liveGrid, nextStep, NO_FILTERS } from '@/components/pages/orders/orders-logic';
import { tableLook } from '@/components/pages/tables/tables-logic';
import type { MenuCategory, ServiceRequest } from '@/contracts';
import { URGENCY_LABEL, URGENCY_TILE, urgencyOf } from '@/utils/urgency';

const T0 = Date.parse('2026-11-12T12:00:00Z');
const WAITER = ['floor.read', 'sessions.manage', 'requests.read', 'requests.create', 'requests.handle', 'staff.read'];
const viewer = (id: string, permissions = WAITER) => ({ id, can: (p: string) => permissions.includes(p) });

let seq = 0;
function request(status: ServiceRequest['status'], extra: Partial<ServiceRequest> = {}): ServiceRequest {
  seq += 1;
  return {
    id: `r${seq}`,
    status,
    type: { id: 'order', label: 'Commande', icon: 'utensils', kind: 'order' },
    table: { id: 't3', label: '3' },
    area: { id: 'a', name: 'Salle' },
    items: [{ menuItemId: 'garba', name: 'Garba', quantity: 2, unitPriceMinor: 1500 }],
    totalMinor: 3000,
    createdAt: new Date(T0 - seq * 1000).toISOString(),
    dueAt: new Date(T0 + 180_000).toISOString(),
    assignee: null,
    escalationStatus: 'none',
    ...extra,
  } as ServiceRequest;
}

describe('Spec 007 — écran Commandes', () => {
  it('CA-007-01 — l’entrée « Commandes » apparaît pour le serveur, le gérant et le propriétaire', () => {
    expect(visibleNav(WAITER).map((item) => item.label)).toContain('Commandes');
    expect(visibleNav(['requests.read']).map((item) => item.label)).not.toContain('Commandes');
  });

  it('CA-007-02 — seules les commandes apparaissent, pas les appels', () => {
    const water = request('pending', { type: { id: 'eau', label: 'De l’eau', icon: 'droplet', kind: 'service' }, items: [], totalMinor: null });
    const order = request('pending');
    const groups = groupOrders([water, order], false);
    expect(groups.todo.map((r) => r.id)).toEqual([order.id]);
  });

  it('CA-007-07 — sans cuisine séparée, le filtre « État » propose deux étapes ; avec, trois', () => {
    expect(columnsFor(false)).toEqual(['todo', 'preparing']);
    expect(columnsFor(true)).toEqual(['todo', 'preparing', 'ready']);
  });

  it('CA-007-04 — maquis : Préparer (rouge), puis Servie (orange)', () => {
    const me = viewer('koffi');
    expect(nextStep(request('pending'), false, me)).toEqual({ action: 'prepare', label: 'Préparer', tone: 'red' });
    const mine = request('in_progress', { assignee: { id: 'koffi', firstName: 'Koffi', lastName: 'Yao' } });
    expect(nextStep(mine, false, me)).toEqual({ action: 'resolve', label: 'Servie', tone: 'orange' });
  });

  it('CA-007-05 — cuisine séparée : Prête (orange), puis Servie (vert) par n’importe quel serveur', () => {
    const koffi = { id: 'koffi', firstName: 'Koffi', lastName: 'Yao' };
    expect(nextStep(request('in_progress', { assignee: koffi }), true, viewer('koffi'))).toEqual({ action: 'ready', label: 'Prête', tone: 'orange' });
    expect(nextStep(request('ready', { assignee: koffi }), true, viewer('fatou'))).toEqual({ action: 'resolve', label: 'Servie', tone: 'green' });
    expect(capabilitiesOf(request('ready', { assignee: koffi }), viewer('fatou')).primary).toEqual({ action: 'resolve', label: 'Servie' });
  });

  it('CA-007-09 — pas de bouton sur une commande que quelqu’un d’autre prépare', () => {
    const koffi = { id: 'koffi', firstName: 'Koffi', lastName: 'Yao' };
    expect(nextStep(request('in_progress', { assignee: koffi }), false, viewer('fatou'))).toBeNull();
    expect(nextStep(request('assigned', { assignee: koffi }), false, viewer('fatou'))).toBeNull();
  });

  it('CA-007-11 — « Annuler » n’est proposé qu’avant la préparation', () => {
    const manager = viewer('awa', [...WAITER, 'requests.cancel', 'requests.assign']);
    expect(capabilitiesOf(request('pending'), manager).cancel).toBe(true);
    expect(capabilitiesOf(request('in_progress', { assignee: { id: 'k', firstName: 'K', lastName: 'Y' } }), manager).cancel).toBe(false);
    expect(capabilitiesOf(request('ready', { assignee: { id: 'k', firstName: 'K', lastName: 'Y' } }), manager).cancel).toBe(false);
  });

  it('R3 — une seule grille, toutes étapes mêlées, la plus ancienne en premier ; le filtre « État » isole une étape', () => {
    const koffi = { id: 'koffi', firstName: 'Koffi', lastName: 'Yao' };
    const preparing = request('in_progress', { assignee: koffi, createdAt: new Date(T0 - 900_000).toISOString() });
    const fresh = request('pending', { createdAt: new Date(T0).toISOString() });
    const ready = request('ready', { assignee: koffi, createdAt: new Date(T0 - 300_000).toISOString() });
    const groups = groupOrders([fresh, ready, preparing], true);
    expect(liveGrid(groups, 'all').map((r) => r.id)).toEqual([preparing.id, ready.id, fresh.id]);
    expect(liveGrid(groups, 'todo').map((r) => r.id)).toEqual([fresh.id]);
    expect(hasFilters({ ...NO_FILTERS, status: 'ready' })).toBe(true);
  });

  it('R3 — la plus ancienne commande est en premier dans son étape', () => {
    const recent = request('pending', { createdAt: new Date(T0).toISOString() });
    const old = request('pending', { createdAt: new Date(T0 - 600_000).toISOString() });
    expect(groupOrders([recent, old], false).todo.map((r) => r.id)).toEqual([old.id, recent.id]);
  });

  it('CA-007-03 — chaque plat a sa photo, sinon l’image de sa rubrique', () => {
    const menu = [
      { id: 'c', name: 'Plats', icon: 'fish', imageId: null, items: [{ id: 'garba', imageId: 'photo-garba' }, { id: 'alloco', imageId: null }] },
    ] as unknown as MenuCategory[];
    const images = dishImages(menu);
    expect(images.get('garba')).toEqual({ imageId: 'photo-garba', icon: 'fish' });
    expect(images.get('alloco')).toEqual({ imageId: null, icon: 'fish' });
  });

  it('CA-007-06 — une commande prête est verte « Prête » sur le tableau de bord et la vue Tables', () => {
    const ready = request('ready');
    expect(urgencyOf(ready, T0)).toBe('ready');
    expect(URGENCY_LABEL.ready).toBe('Prête');
    expect(URGENCY_TILE.ready).toContain('bg-done');
    expect(tableLook('occupied', [ready], T0)).toMatchObject({ tone: 'ready', label: 'Prête' });
  });

  it('CA-007-12 — recherche sur la table, les plats et la note, sans accents ; zone et « qui » se combinent', () => {
    const koffi = { id: 'koffi', firstName: 'Koffi', lastName: 'Yao' };
    const garba = request('pending', { table: { id: 't3', label: '3' }, area: { id: 'salle', name: 'Salle' }, items: [{ menuItemId: 'g', name: 'Garba', quantity: 1, unitPriceMinor: 1500 }] });
    const alloco = request('in_progress', {
      table: { id: 'tt2', label: 'T2' },
      area: { id: 'terrasse', name: 'Terrasse' },
      items: [{ menuItemId: 'a', name: 'Attiéké poisson', quantity: 1, unitPriceMinor: 2500 }],
      note: 'Sans piment',
      assignee: koffi,
    });
    const all = [garba, alloco];
    const ids = (filters: Partial<typeof NO_FILTERS>) => filterOrders(all, { ...NO_FILTERS, ...filters }, 'koffi').map((r) => r.id);
    expect(ids({ query: 'garba' })).toEqual([garba.id]);
    expect(ids({ query: 'attieke' })).toEqual([alloco.id]);
    expect(ids({ query: 'PIMENT' })).toEqual([alloco.id]);
    expect(ids({ query: 't2' })).toEqual([alloco.id]);
    expect(ids({ areaId: 'terrasse' })).toEqual([alloco.id]);
    expect(ids({ who: 'mine' })).toEqual([alloco.id]);
    expect(ids({ who: 'nobody' })).toEqual([garba.id]);
    expect(ids({ query: 'garba', areaId: 'terrasse' })).toEqual([]);
    expect(ids({ query: 'zzz' })).toEqual([]);
    expect(hasFilters({ ...NO_FILTERS, query: 'zzz' })).toBe(true);
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });
});
