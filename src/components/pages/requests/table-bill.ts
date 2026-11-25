import type { OccupationSession, ServiceRequest } from '@/contracts';

/** Spec 028, R10 : ce que la fiche d'une table met en avant quand l'addition est demandée. */
export interface TableSheet {
  /** Cartes d'addition en tête de fiche, la plus ancienne d'abord. */
  bills: ServiceRequest[];
  /** « En cours » sans les demandes d'addition. */
  others: ServiceRequest[];
  /** Repères des clients qui ont demandé l'addition. */
  billMarkers: Set<number>;
  /** Pastilles compactes à la place des quatre tuiles. */
  compact: boolean;
}

export function tableSheet(requests: ServiceRequest[], settledShown: boolean): TableSheet {
  const bills = requests.filter((request) => request.type.kind === 'bill').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const others = requests.filter((request) => request.type.kind !== 'bill');
  const billMarkers = new Set(bills.flatMap((request) => (request.marker === null || request.marker === undefined ? [] : [request.marker])));
  return { bills, others, billMarkers, compact: bills.length > 0 || settledShown };
}

/** R10 : le client qui a demandé l'addition se règle depuis la carte d'addition, pas une seconde fois dans « Clients ». */
export function clientSlide(session: OccupationSession, billMarkers: Set<number>, canSettle: boolean): boolean {
  return canSettle && session.unpaidMinor > 0 && !billMarkers.has(session.marker);
}

/** R10 : plus rien à régler, la table se libère d'un glissement ; sinon bouton et confirmation (spec 026, R5). */
export function freeGesture(loaded: boolean, unpaidMinor: number): 'slide' | 'button' {
  return loaded && unpaidMinor === 0 ? 'slide' : 'button';
}
