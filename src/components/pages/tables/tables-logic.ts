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
 * Spec 006, R2 bis, et spec 023 : couleur d'une table, avec le code du plan de salle du tableau de bord.
 * Les demandes en cours priment ; sinon servie (vert), occupée (orange) ou libre (blanc).
 */
export type TableTone = Urgency | 'served' | 'occupied' | 'free';

export interface TableLook {
  tone: TableTone;
  label: string;
  /** Demande la plus ancienne en cours, pour le chronomètre. */
  oldestCreatedAt: string | null;
  escalated: boolean;
}

type ActiveRequest = Pick<ServiceRequest, 'status' | 'createdAt' | 'dueAt' | 'escalationStatus'>;

const QUIET_LABEL = { served: 'Servie', occupied: 'Occupée', free: 'Libre' } as const;

/** Spec 023, R2 et R3 : `served` vaut vrai quand une commande de l'occupation a été servie. */
export function tableLook(status: TableStatus, requests: ActiveRequest[], now: number, served = false): TableLook {
  const urgency = worstUrgency(requests.map((request) => urgencyOf(request, now)));
  const oldestCreatedAt = requests.reduce<string | null>((min, r) => (!min || r.createdAt < min ? r.createdAt : min), null);
  const escalated = requests.some((request) => request.escalationStatus === 'escalated');
  if (urgency && urgency !== 'done') return { tone: urgency, label: URGENCY_LABEL[urgency], oldestCreatedAt, escalated };
  const tone = status === 'free' ? 'free' : served ? 'served' : 'occupied';
  return { tone, label: QUIET_LABEL[tone], oldestCreatedAt: null, escalated: false };
}

/**
 * Spec 023, R3 : une table occupée, sans demande en cours, avec un montant non nul a été servie
 * (le montant ne compte que les commandes non annulées ; sans demande en cours, elles sont toutes servies).
 */
export function isServed(table: Pick<TableStatusView, 'status' | 'amountMinor'>, activeRequests: number): boolean {
  return table.status === 'occupied' && activeRequests === 0 && (table.amountMinor ?? 0) > 0;
}

/** Les états où quelqu'un doit agir : fond plein. Les autres : fond pâle (spec 023, § 5). */
export function isActionTone(tone: TableTone): boolean {
  return tone === 'calm' || tone === 'waiting' || tone === 'late' || tone === 'ready';
}

/** Pastille et plateau posés sur un fond blanc (fiche d'une table). */
export const TONE_BADGE: Record<TableTone, string> = {
  ...URGENCY_TILE,
  served: 'bg-done-soft text-done',
  occupied: 'bg-brand-soft text-brand',
  free: 'bg-sunken text-ink-2',
};

export const TONE_PLATE: Record<TableTone, string> = {
  ...URGENCY_TILE,
  served: 'bg-done-soft text-ink',
  occupied: 'bg-brand-soft text-ink',
  free: 'bg-sunken text-ink',
};

/** Spec 023, R1 : fond de la carte de la vue « Tables » — pâle s'il n'y a rien à faire, plein s'il faut agir. */
export const TONE_CARD: Record<TableTone, string> = {
  free: 'bg-surface text-ink ring-1 ring-line',
  occupied: 'bg-brand-soft text-ink ring-1 ring-brand/25',
  progress: 'bg-progress-soft text-ink ring-1 ring-progress/25',
  served: 'bg-done-soft text-ink ring-1 ring-done/25',
  done: 'bg-done-soft text-ink ring-1 ring-done/25',
  calm: 'bg-ink-2 text-white',
  waiting: 'bg-wait text-wait-ink ring-1 ring-wait-ink/20',
  late: 'bg-late text-white',
  ready: 'bg-ready text-white',
};

/** Pastille sur la carte : même famille que le fond, en plus soutenu. */
export const CARD_BADGE: Record<TableTone, string> = {
  free: 'bg-sunken text-ink-2',
  occupied: 'bg-brand text-white',
  progress: 'bg-progress text-white',
  served: 'bg-done text-white',
  done: 'bg-done text-white',
  calm: 'bg-white/20 text-white',
  waiting: 'bg-white/60 text-wait-ink',
  late: 'bg-white/20 text-white',
  ready: 'bg-white/20 text-white',
};

/** Plateau sur la carte : blanc sur un fond pâle, translucide sur un fond plein. */
export const CARD_PLATE: Record<TableTone, string> = {
  free: 'bg-sunken text-ink',
  occupied: 'bg-surface text-ink',
  progress: 'bg-surface text-ink',
  served: 'bg-surface text-ink',
  done: 'bg-surface text-ink',
  calm: 'bg-white/20 text-white',
  waiting: 'bg-white/60 text-wait-ink',
  late: 'bg-white/20 text-white',
  ready: 'bg-white/20 text-white',
};

/** Spec 023, R5 : légende, d'abord les états sans action (pâles), puis ceux où il faut agir (pleins). */
export const TONE_LEGEND: { tone: TableTone; label: string; swatch: string }[] = [
  { tone: 'free', label: 'Libre', swatch: 'bg-surface ring-1 ring-line' },
  { tone: 'occupied', label: 'Occupée', swatch: 'bg-brand-soft ring-1 ring-brand/30' },
  { tone: 'progress', label: URGENCY_LABEL.progress, swatch: 'bg-progress-soft ring-1 ring-progress/30' },
  { tone: 'served', label: 'Servie', swatch: 'bg-done-soft ring-1 ring-done/30' },
  { tone: 'calm', label: URGENCY_LABEL.calm, swatch: 'bg-ink-2' },
  { tone: 'waiting', label: URGENCY_LABEL.waiting, swatch: 'bg-wait' },
  { tone: 'late', label: URGENCY_LABEL.late, swatch: 'bg-late' },
  { tone: 'ready', label: URGENCY_LABEL.ready, swatch: 'bg-ready' },
];

// ------------------------------------------------------------- spec 020 : fiche d'une table

/** Spec 020, R1 : teinte du bandeau de la fiche, même code que la carte et le tableau de bord. */
export const TONE_TINT: Record<TableTone, string> = {
  free: 'var(--color-ink-3)',
  occupied: 'var(--color-brand)',
  served: 'var(--color-done)',
  calm: 'var(--color-ink-2)',
  waiting: '#e9a300',
  late: 'var(--color-late)',
  progress: 'var(--color-progress)',
  ready: 'var(--color-ready)',
  done: 'var(--color-done)',
};

/** Spec 020, R2 : durée d'occupation lisible d'un coup d'œil — « 8 min », « 1 h 25 ». */
export function occupiedFor(since: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Spec 020, R4 : une commande en une ligne — plats différents et articles. */
export function orderSummary(items: { menuItemId: string; quantity: number }[]): { dishes: number; articles: number } {
  return { dishes: new Set(items.map((item) => item.menuItemId)).size, articles: items.reduce((sum, item) => sum + item.quantity, 0) };
}

/** Spec 020, R4 : état d'une commande, en mots courts. */
export function orderStateLabel(status: string): { label: string; tone: 'done' | 'progress' | 'waiting' | 'cancelled' } {
  if (status === 'resolved') return { label: 'Servie', tone: 'done' };
  if (status === 'cancelled') return { label: 'Annulée', tone: 'cancelled' };
  if (status === 'accepted' || status === 'in_progress' || status === 'ready') return { label: status === 'ready' ? 'Prête' : 'En préparation', tone: 'progress' };
  return { label: 'Envoyée', tone: 'waiting' };
}
