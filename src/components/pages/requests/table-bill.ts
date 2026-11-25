import type { OccupationSession, ServiceRequest } from '@/contracts';

/** Spec 028, R10 : ce que la fiche d'une table met en avant quand l'addition est demandée. */
export interface TableSheet {
  /** Cartes d'addition en tête de fiche, la plus ancienne d'abord. */
  bills: ServiceRequest[];
  /** Spec 029, R7 : appels et messages en tête de fiche, les messages d'un même client regroupés. */
  calls: ServerGroup[];
  /** « En cours » sans l'addition, l'appel ni les messages. */
  others: ServiceRequest[];
  /** Repères des clients qui ont demandé l'addition. */
  billMarkers: Set<number>;
  /** Pastilles compactes à la place des quatre tuiles. */
  compact: boolean;
}

/** Un appel, ou les messages d'un client, et le geste qui leur revient. */
export interface ServerGroup {
  key: string;
  kind: 'call' | 'message';
  marker: number | null;
  requests: ServiceRequest[];
  /** Tant qu'une demande du groupe attend : « J'y vais » ; toutes prises : « Fait ». */
  waiting: boolean;
}

const isServer = (request: ServiceRequest) => request.type.kind === 'call' || request.type.kind === 'message';

export function serverGroups(requests: ServiceRequest[]): ServerGroup[] {
  const groups = new Map<string, ServerGroup>();
  for (const request of [...requests].filter(isServer).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const kind = request.type.kind as 'call' | 'message';
    const marker = request.marker ?? null;
    const key = kind === 'call' ? `call:${request.id}` : `message:${marker ?? request.id}`;
    const group = groups.get(key) ?? { key, kind, marker, requests: [], waiting: false };
    group.requests.push(request);
    group.waiting = group.waiting || ['pending', 'assigned', 'accepted'].includes(request.status);
    groups.set(key, group);
  }
  // L'appel d'abord : c'est le plus pressé.
  return [...groups.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'call' ? -1 : 1));
}

export function tableSheet(requests: ServiceRequest[], settledShown: boolean): TableSheet {
  const bills = requests.filter((request) => request.type.kind === 'bill').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const calls = serverGroups(requests);
  const others = requests.filter((request) => request.type.kind !== 'bill' && !isServer(request));
  const billMarkers = new Set(bills.flatMap((request) => (request.marker === null || request.marker === undefined ? [] : [request.marker])));
  return { bills, calls, others, billMarkers, compact: bills.length > 0 || calls.length > 0 || settledShown };
}

/** R10 : le client qui a demandé l'addition se règle depuis la carte d'addition, pas une seconde fois dans « Clients ». */
export function clientSlide(session: OccupationSession, billMarkers: Set<number>, canSettle: boolean): boolean {
  return canSettle && session.unpaidMinor > 0 && !billMarkers.has(session.marker);
}

/** R10 : plus rien à régler, la table se libère d'un glissement ; sinon bouton et confirmation (spec 026, R5). */
export function freeGesture(loaded: boolean, unpaidMinor: number): 'slide' | 'button' {
  return loaded && unpaidMinor === 0 ? 'slide' : 'button';
}

/** Spec 029, R6 : appels et messages que personne n'a encore pris, le plus récent en bas (au plus près du pouce). */
export function incomingCalls(requests: ServiceRequest[]): ServiceRequest[] {
  return requests
    .filter((request) => (request.type.kind === 'call' || request.type.kind === 'message') && (request.status === 'pending' || request.status === 'assigned'))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
