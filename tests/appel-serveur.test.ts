import { describe, expect, it } from 'vitest';
import { hasServerButton, isServerRequest, serverTypes } from '@/components/pages/guest/server-logic';
import { capabilitiesOf } from '@/components/pages/requests/capabilities';
import { incomingCalls, serverGroups, tableSheet } from '@/components/pages/requests/table-bill';
import { guestContextSchema, guestRequestSchema, type ServiceRequest } from '@/contracts';

const WAITER = ['requests.read', 'requests.handle', 'requests.cancel'];
const viewer = (id = 'fatou', permissions = WAITER) => ({ id, can: (p: string) => permissions.includes(p) });
const FATOU = { id: 'fatou', firstName: 'Fatou', lastName: 'K.' };

const CALL = { id: 'call', label: 'Appeler un serveur', icon: 'bell', kind: 'call' as const };
const MESSAGE = { id: 'msg', label: 'Message', icon: 'message-circle', kind: 'message' as const };
const WATER = { id: 'eau', label: 'De l’eau', icon: 'droplet', kind: 'service' as const };

let seq = 0;
function staffRequest(type: ServiceRequest['type'], extra: Partial<ServiceRequest> = {}): ServiceRequest {
  seq += 1;
  return {
    id: `r${seq}`,
    status: 'pending',
    type,
    table: { id: 't5', label: '5' },
    area: { id: 'a', name: 'Salle' },
    items: [],
    totalMinor: null,
    assignee: null,
    escalationStatus: 'none',
    note: null,
    createdAt: new Date(Date.UTC(2026, 10, 25, 21, 0, seq)).toISOString(),
    dueAt: new Date().toISOString(),
    marker: 0,
    bill: null,
    ...extra,
  } as ServiceRequest;
}

describe('Spec 029 — appel et message', () => {
  it('CA-029-01 — le bouton « Serveur » ne propose que l’appel et le message', () => {
    const context = guestContextSchema.parse({
      establishment: { name: 'Chez Aya', currency: 'XOF' },
      table: { label: '5', area: 'Salle' },
      requestTypes: [
        { id: 'call', label: 'Appeler un serveur', icon: 'bell', allowNote: false, kind: 'call' },
        { id: 'eau', label: 'De l’eau', icon: 'droplet', allowNote: false },
        { id: 'aide', label: 'Assistance', icon: 'life-buoy', allowNote: true },
        { id: 'msg', label: 'Message', icon: 'message-circle', allowNote: true, kind: 'message' },
      ],
      menu: [],
      orderingEnabled: false,
    });
    const { call, message } = serverTypes(context.requestTypes);
    expect([call?.id, message?.id]).toEqual(['call', 'msg']);
    expect(hasServerButton(context.requestTypes)).toBe(true);
    // Contexte d'avant la mise à jour (genre absent) : la cloche et la bulle restent l'appel et le message.
    const legacy = guestContextSchema.parse({
      establishment: { name: 'Chez Aya', currency: 'XOF' },
      table: { label: '5', area: 'Salle' },
      requestTypes: [
        { id: 'bell', label: 'Appeler un serveur', icon: 'bell', allowNote: false },
        { id: 'autre', label: 'Autre demande', icon: 'message-circle', allowNote: true },
      ],
      menu: [],
      orderingEnabled: false,
    }).requestTypes;
    expect(serverTypes(legacy).call?.id).toBe('bell');
    expect(serverTypes(legacy).message?.id).toBe('autre');
    expect(hasServerButton(legacy)).toBe(true);
    // Sans appel ni message, pas de bouton : « Assistance » seule ne suffit plus.
    expect(hasServerButton(context.requestTypes.filter((type) => type.kind === 'service'))).toBe(false);
  });

  it('CA-029-02 et 04 — appel et message ont leur propre carte, le message garde son texte', () => {
    const request = guestRequestSchema.parse({
      id: 'm1',
      status: 'pending',
      type: MESSAGE,
      items: [],
      totalMinor: null,
      quantity: null,
      handledBy: null,
      createdAt: '2026-11-25T21:00:00Z',
      acceptedAt: null,
      startedAt: null,
      resolvedAt: null,
      cancelledAt: null,
      note: 'Une chaise pour bébé',
    });
    expect(isServerRequest(request)).toBe(true);
    expect(request.note).toBe('Une chaise pour bébé');
    expect(isServerRequest({ type: WATER })).toBe(false);
  });

  it('CA-029-05 et CA-048-01 — en bas de l’écran : appels et messages que personne n’a pris, le plus récent en haut', () => {
    const call = staffRequest(CALL);
    const message = staffRequest(MESSAGE, { note: 'Une chaise pour bébé' });
    const taken = staffRequest(CALL, { status: 'in_progress', assignee: FATOU });
    const water = staffRequest(WATER);
    expect(incomingCalls([water, taken, call, message]).map((request) => request.id)).toEqual([message.id, call.id]);
  });

  it('CA-029-06 — « J’y vais » puis « Fait », en glissant', () => {
    expect(capabilitiesOf(staffRequest(CALL), viewer()).primary).toEqual({ action: 'prepare', label: 'Glisser · J’y vais', gesture: 'slide', tone: 'ink' });
    const mine = staffRequest(CALL, { status: 'in_progress', assignee: FATOU });
    expect(capabilitiesOf(mine, viewer()).primary).toEqual({ action: 'resolve', label: 'Glisser · Fait', gesture: 'slide', tone: 'green' });
    // Pris par Fatou : pas de geste pour Yao.
    expect(capabilitiesOf(mine, viewer('yao')).primary).toBeNull();
    expect(capabilitiesOf(staffRequest(MESSAGE), viewer('yao', ['requests.read'])).primary).toBeNull();
  });

  it('CA-029-06 et CA-048-01 — fiche de la table : appel en tête, messages d’un client regroupés (le plus récent d’abord), hors « En cours »', () => {
    const water = staffRequest(WATER);
    const first = staffRequest(MESSAGE, { marker: 2, note: 'Une chaise pour bébé' });
    const second = staffRequest(MESSAGE, { marker: 2, note: 'Et de la glace aussi' });
    const other = staffRequest(MESSAGE, { marker: 4, note: 'Du piment' });
    const call = staffRequest(CALL);
    const groups = serverGroups([first, water, other, call, second]);
    expect(groups.map((group) => group.kind)).toEqual(['call', 'message', 'message']);
    // Spec 048 : le groupe au message le plus récent (« Du piment ») passe devant ; dans un groupe, le plus récent d'abord.
    expect(groups.map((group) => group.marker)).toEqual([0, 4, 2]);
    expect(groups[2].requests.map((request) => request.note)).toEqual(['Et de la glace aussi', 'Une chaise pour bébé']);
    expect(groups.every((group) => group.waiting)).toBe(true);
    const sheet = tableSheet([first, water, call], false);
    expect(sheet.others.map((request) => request.id)).toEqual([water.id]);
    expect(sheet.compact).toBe(true);
    // Tout est pris : le groupe passe à « Fait ».
    expect(serverGroups([staffRequest(CALL, { status: 'in_progress', assignee: FATOU })])[0].waiting).toBe(false);
  });
});
