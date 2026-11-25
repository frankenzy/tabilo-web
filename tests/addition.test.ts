import { describe, expect, it } from 'vitest';
import { billState } from '@/components/pages/guest/order-logic';
import { capabilitiesOf } from '@/components/pages/requests/capabilities';
import { guestContextSchema, type GuestRequest, type ServiceRequest } from '@/contracts';

const WAITER = ['requests.read', 'requests.handle', 'requests.cancel'];
const viewer = (permissions = WAITER) => ({ id: 'fatou', can: (p: string) => permissions.includes(p) });

const ORDER = { id: 'order', label: 'Commande', icon: 'utensils', kind: 'order' as const };
const BILL = { id: 'bill', label: 'L’addition', icon: 'receipt', kind: 'bill' as const };

function guest(status: GuestRequest['status'], type: GuestRequest['type'] = ORDER, extra: Partial<GuestRequest> = {}): GuestRequest {
  return { id: Math.random().toString(36), status, type, items: [], totalMinor: type.kind === 'order' ? 1500 : null, paidAt: null, ...extra } as GuestRequest;
}

function billRequest(extra: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: 'b1',
    status: 'pending',
    type: BILL,
    table: { id: 't2', label: '2' },
    area: { id: 'a', name: 'Salle' },
    items: [],
    totalMinor: null,
    assignee: null,
    escalationStatus: 'none',
    createdAt: new Date().toISOString(),
    dueAt: new Date().toISOString(),
    marker: 0,
    bill: { dueMinor: 4500, pendingOrders: 0 },
    ...extra,
  } as ServiceRequest;
}

describe('Spec 028 — l’addition', () => {
  it('CA-028-01 — servi et non réglé : barre à glisser avec le montant ; glissée : facture tout de suite', () => {
    const served = [guest('resolved'), guest('resolved', ORDER, { totalMinor: 3000 })];
    expect(billState(served, true)).toEqual({ status: 'available', dueMinor: 4500 });
    // Affichage immédiat pendant l'envoi, avant la réponse du serveur.
    expect(billState(served, true, true)).toEqual({ status: 'pending', dueMinor: 4500, pendingOrders: 0 });
  });

  it('CA-028-02 — rien à régler, pas de barre', () => {
    expect(billState([], true).status).toBe('none');
    expect(billState([guest('in_progress')], true).status).toBe('none');
    expect(billState([guest('resolved', ORDER, { paidAt: '2026-11-25T19:00:00Z' })], true).status).toBe('none');
    // Établissement qui a masqué « L'addition ».
    expect(billState([guest('resolved')], false).status).toBe('none');
  });

  it('CA-028-03 et 12 — demande ouverte : la facture remplace la barre, commandes en cours à part', () => {
    const state = billState([guest('resolved'), guest('pending', BILL), guest('in_progress')], true);
    expect(state).toEqual({ status: 'pending', dueMinor: 1500, pendingOrders: 1 });
    // Close (règlement) : la demande ne compte plus.
    expect(billState([guest('resolved'), guest('resolved', BILL)], true).status).toBe('available');
  });

  it('CA-028-07 et 08 — personnel : un seul geste, « Glisser pour régler » ; ni accepter, ni affecter', () => {
    const caps = capabilitiesOf(billRequest(), viewer());
    expect(caps.primary).toEqual({ action: 'settle-bill', label: 'Glisser pour régler', gesture: 'slide', tone: 'ink' });
    expect(caps.assign || caps.transfer || caps.release).toBe(false);
    // Sans droit de traiter, ou plus rien à régler : pas de geste.
    expect(capabilitiesOf(billRequest(), viewer(['requests.read'])).primary).toBeNull();
    expect(capabilitiesOf(billRequest({ bill: { dueMinor: 0, pendingOrders: 1 } }), viewer()).primary).toBeNull();
  });

  it('CA-028-14 — le téléphone reconnaît l’addition à son genre, pas à son pictogramme', () => {
    const context = guestContextSchema.parse({
      establishment: { name: 'Chez Aya', currency: 'XOF' },
      table: { label: '2', area: 'Salle' },
      requestTypes: [
        { id: 'a', label: 'La note', icon: 'bell', allowNote: false, kind: 'bill' },
        { id: 'b', label: 'Eau', icon: 'droplet', allowNote: false },
      ],
      menu: [],
      orderingEnabled: false,
    });
    expect(context.requestTypes.map((type) => type.kind)).toEqual(['bill', 'service']);
  });
});
