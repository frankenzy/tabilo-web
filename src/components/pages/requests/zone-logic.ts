import type { ZoneSignal } from '@/contracts';

/** Spec 027, R8 : « 230 m », « 2,3 km ». */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

/** Libellé du signalement de zone ; null quand il n'y a rien à signaler (dans la zone, ou pas de zone). */
export function zoneLabel(zone: ZoneSignal | null | undefined): string | null {
  if (!zone) return null;
  if (zone.status === 'outside') return zone.distanceM !== null ? `Hors zone · ${formatDistance(zone.distanceM)}` : 'Hors zone';
  if (zone.status === 'imprecise') return 'Position imprécise';
  if (zone.status === 'denied') return 'Position refusée';
  return null;
}
