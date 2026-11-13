import type { ServiceRequest, TableStatus, TableStatusView } from '@/contracts';
import { URGENCY_LABEL, URGENCY_TILE, urgencyOf, worstUrgency, type Urgency } from '@/utils/urgency';

/** Spec 006, R3 : la taille découle du nombre de couverts. */
export type TableSize = 'Petite' | 'Moyenne' | 'Grande';

export function tableSize(seats: number): TableSize {
  if (seats <= 4) return 'Petite';
  if (seats <= 6) return 'Moyenne';
  return 'Grande';
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export interface TableFilters {
  query: string;
  status: TableStatus | 'all';
  areaId: string | 'all';
}

/** Spec 006, R6 : recherche sur le nom (sans accents ni majuscules), combinée aux filtres état et zone. */
export function filterTables(tables: TableStatusView[], filters: TableFilters): TableStatusView[] {
  const needle = fold(filters.query);
  return tables.filter(
    (table) =>
      (filters.status === 'all' || table.status === filters.status) &&
      (filters.areaId === 'all' || table.areaId === filters.areaId) &&
      (!needle || fold(table.label).includes(needle)),
  );
}

/** Spec 006, R5 : compteurs calculés sur toutes les tables actives, pas sur le résultat filtré. */
export function tableCounts(tables: TableStatusView[]): { occupied: number; free: number; total: number } {
  const occupied = tables.filter((table) => table.status === 'occupied').length;
  return { occupied, free: tables.length - occupied, total: tables.length };
}

/** Zones présentes, dans l'ordre où l'API renvoie les tables (ordre des zones). */
export function areasOf(tables: TableStatusView[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  tables.forEach((table) => {
    if (!seen.has(table.areaId)) seen.set(table.areaId, table.areaName);
  });
  return [...seen].map(([id, name]) => ({ id, name }));
}

/**
 * Spec 006, R2 bis : couleur d'une table, avec le code du plan de salle du tableau de bord.
 * Les demandes en cours priment ; sinon l'occupation (orange) ou libre (vert).
 */
export type TableTone = Urgency | 'occupied' | 'free';

export interface TableLook {
  tone: TableTone;
  label: string;
  /** Demande la plus ancienne en cours, pour le chronomètre. */
  oldestCreatedAt: string | null;
  escalated: boolean;
}

type ActiveRequest = Pick<ServiceRequest, 'status' | 'createdAt' | 'dueAt' | 'escalationStatus'>;

export function tableLook(status: TableStatus, requests: ActiveRequest[], now: number): TableLook {
  const urgency = worstUrgency(requests.map((request) => urgencyOf(request, now)));
  const oldestCreatedAt = requests.reduce<string | null>((min, r) => (!min || r.createdAt < min ? r.createdAt : min), null);
  const escalated = requests.some((request) => request.escalationStatus === 'escalated');
  if (urgency && urgency !== 'done') return { tone: urgency, label: URGENCY_LABEL[urgency], oldestCreatedAt, escalated };
  return { tone: status, label: status === 'occupied' ? 'Occupée' : 'Libre', oldestCreatedAt: null, escalated: false };
}

export const TONE_BADGE: Record<TableTone, string> = {
  ...URGENCY_TILE,
  occupied: 'bg-brand-soft text-brand',
  free: 'bg-done-soft text-done',
};

/** Plateau dessiné : mêmes couleurs ; libre et occupée gardent le plateau clair de la maquette. */
export const TONE_PLATE: Record<TableTone, string> = {
  ...URGENCY_TILE,
  occupied: 'bg-brand-soft text-ink',
  free: 'bg-brand-soft text-ink',
};

/** Légende, dans l'ordre du tableau de bord, précédée des deux états sans demande. */
export const TONE_LEGEND: { tone: TableTone; label: string; swatch: string }[] = [
  { tone: 'free', label: 'Libre', swatch: 'bg-done-soft ring-1 ring-done/30' },
  { tone: 'occupied', label: 'Occupée', swatch: 'bg-brand-soft ring-1 ring-brand/30' },
  { tone: 'calm', label: URGENCY_LABEL.calm, swatch: 'bg-calm ring-1 ring-line' },
  { tone: 'waiting', label: URGENCY_LABEL.waiting, swatch: 'bg-wait' },
  { tone: 'late', label: URGENCY_LABEL.late, swatch: 'bg-late' },
  { tone: 'progress', label: URGENCY_LABEL.progress, swatch: 'bg-progress-soft ring-1 ring-progress/30' },
  { tone: 'ready', label: URGENCY_LABEL.ready, swatch: 'bg-done' },
];
