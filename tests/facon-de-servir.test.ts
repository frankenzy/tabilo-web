import { describe, expect, it } from 'vitest';
import { billState, unpaidTotal } from '@/components/pages/guest/order-logic';
import { columnOf, columnsFor, groupOrders, nextStep } from '@/components/pages/orders/orders-logic';
import { capabilitiesOf } from '@/components/pages/requests/capabilities';
import { guestContextSchema, type GuestRequest, type ServiceRequest } from '@/contracts';

/** Spec 030 — façon de servir : logique de l'écran client et de l'écran « Commandes ». */

const WAITER = ['requests.read', 'requests.handle', 'requests.cancel'];
const viewer = (permissions = WAITER) => ({ id: 'koffi', can: (p: string) => permissions.includes(p) });
const ORDER = { id: 'order', label: 'Commande', icon: 'utensils', kind: 'order' as const };

function guest(status: GuestRequest['status'], extra: Partial<GuestRequest> = {}): GuestRequest {
  return { id: Math.random().toString(36), status, type: ORDER, items: [], totalMinor: 3500, paidAt: null, ...extra } as GuestRequest;
}

function staff(status: ServiceRequest['status'], extra: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: Math.random().toString(36),
    status,
    type: ORDER,
    table: { id: 't4', label: '4' },
    area: { id: 'a', name: 'Salle' },
    items: [],
    totalMinor: 3500,
    assignee: null,
    escalationStatus: 'none',
    createdAt: new Date().toISOString(),
    dueAt: new Date().toISOString(),
    paidAt: null,
    ...extra,
  } as ServiceRequest;
}

describe('Spec 030 — façon de servir', () => {
  it('CA-030-01 — sans réglage reçu, le téléphone reste en « Servir puis régler »', () => {
    const context = guestContextSchema.parse({
      establishment: { name: 'Chez Awa', currency: 'XOF' },
      table: { label: '4', area: 'Salle' },
      requestTypes: [],
      menu: [],
      orderingEnabled: false,
    });
    expect(context.serviceMode).toBe('serve_then_pay');
    expect(billState([guest('in_progress')], true)).toEqual({ status: 'none' });
  });

  it('CA-030-04 — caisse d’abord : la commande à encaisser a sa colonne et passe en tête', () => {
    expect(columnsFor(false, 'pay_first')[0]).toBe('collect');
    expect(columnsFor(false, 'serve_then_pay')).not.toContain('collect');
    expect(columnOf({ status: 'awaiting_payment' })).toBe('collect');
  });

  it('CA-030-05 — caisse d’abord : « Glisser · Encaissé » pour tout serveur, puis il sert ce qui part sans affectation', () => {
    const step = nextStep(staff('awaiting_payment'), false, viewer());
    expect(step).toMatchObject({ action: 'settle', label: 'Glisser · Encaissé', gesture: 'slide' });
    expect(nextStep(staff('in_progress'), false, viewer())).toMatchObject({ action: 'resolve' });
    expect(nextStep(staff('in_progress', { assignee: { id: 'awa', firstName: 'Awa', lastName: 'K' } }), false, viewer())).toBeNull();
  });

  it('CA-030-06 — annulation proposée avant l’encaissement seulement', () => {
    expect(capabilitiesOf(staff('awaiting_payment'), viewer()).cancel).toBe(true);
    expect(capabilitiesOf(staff('pending', { paidAt: new Date().toISOString() }), viewer()).cancel).toBe(false);
  });

  it('CA-030-07 — caisse d’abord : pas d’addition', () => {
    expect(billState([guest('resolved')], true, false, 'pay_first')).toEqual({ status: 'none' });
  });

  it('CA-030-09 — régler quand on veut : l’addition compte la commande en cours', () => {
    const requests = [guest('in_progress'), guest('cancelled'), guest('resolved', { paidAt: new Date().toISOString() })];
    expect(unpaidTotal(requests, 'pay_anytime')).toBe(3500);
    expect(billState(requests, true, false, 'pay_anytime')).toEqual({ status: 'available', dueMinor: 3500 });
  });

  it('une commande à la fois en cours et à régler n’apparaît qu’une fois', () => {
    const order = staff('awaiting_payment');
    const groups = groupOrders([order, order], false);
    expect(groups.collect).toHaveLength(1);
  });
});
