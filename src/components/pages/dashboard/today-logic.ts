import type { TimelineBucket, TimelinePoint } from '@/contracts';

/** Spec 008, R5 : tendance d'un produit par rapport à son rang hier à la même heure. */
export type Trend = 'up' | 'down' | 'same' | 'new';

export function trendOf(rank: number, previousRank: number | null): Trend {
  if (previousRank === null) return 'new';
  if (rank < previousRank) return 'up';
  if (rank > previousRank) return 'down';
  return 'same';
}

export function trendHint(previousRank: number | null): string {
  if (previousRank === null) return 'Pas commandé hier à cette heure';
  return `${previousRank === 1 ? '1er' : `${previousRank}e`} hier à la même heure`;
}

/** Spec 008, R4 : rang 1 or, rang 2 argent, rang 3 bronze. */
export const RANK_COLORS: Record<number, { name: string; badge: string; edge: string }> = {
  1: { name: 'Or', badge: 'bg-[#d4a017] text-white', edge: 'bg-[#d4a017]' },
  2: { name: 'Argent', badge: 'bg-[#9aa0a6] text-white', edge: 'bg-[#9aa0a6]' },
  3: { name: 'Bronze', badge: 'bg-[#b06f3c] text-white', edge: 'bg-[#b06f3c]' },
};

/** Spec 008, R2 : états du graphique par heure, dans l'ordre d'empilement (du bas vers le haut). */
export const HOUR_SERIES: { key: keyof Omit<TimelinePoint, 'period'>; label: string; color: string }[] = [
  { key: 'resolved', label: 'Terminée', color: 'var(--color-ink-3)' },
  { key: 'ready', label: 'Prête', color: 'var(--color-done)' },
  { key: 'progress', label: 'Prise en charge', color: 'var(--color-progress)' },
  { key: 'waiting', label: 'En attente', color: 'var(--color-wait)' },
  { key: 'cancelled', label: 'Annulée', color: 'var(--color-late)' },
];

export function hourTotal(hour: Omit<TimelinePoint, 'period'>): number {
  return HOUR_SERIES.reduce((sum, series) => sum + hour[series.key], 0);
}

/** Spec 008, R7 : découpage, dans l'ordre affiché, et filtres de date qu'il demande. */
export const BUCKETS: { value: TimelineBucket; label: string; title: string; filters: ('year' | 'month' | 'day')[] }[] = [
  { value: 'month', label: 'Mois', title: 'Demandes par mois', filters: ['year'] },
  { value: 'day', label: 'Jour', title: 'Demandes par jour', filters: ['year', 'month'] },
  { value: 'hour', label: 'Heure', title: 'Demandes par heure', filters: ['year', 'month', 'day'] },
];

export const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Date du jour dans un fuseau donné : valeurs par défaut des filtres (R7). */
export function todayIn(timeZone: string | undefined, now = new Date()): { year: number; month: number; day: number } {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now)
    .split('-')
    .map(Number);
  return { year, month, day };
}

/** Change le mois ou l'année sans laisser un jour impossible (31 → 30 en avril, 29 février…). */
export function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

/** Étiquette de l'axe : « 14 h », « 3 », « nov. ». La période est déjà en heure locale. */
export function periodLabel(period: string, bucket: TimelineBucket): string {
  const [date, time] = period.split('T');
  const [, month, day] = date.split('-');
  switch (bucket) {
    case 'hour':
      return `${time.slice(0, 2)} h`;
    case 'day':
      return String(Number(day));
    case 'month':
      return MONTHS[Number(month) - 1];
  }
}

/** Spec 009, R5 : évolution par rapport à la même durée de la période précédente. */
export type SalesTrend = { kind: 'none' } | { kind: 'up' | 'down' | 'same'; percent: number };

export function salesTrend(current: number | null, previous: number | null): SalesTrend {
  if (current === null || previous === null || previous === 0) return { kind: 'none' };
  const percent = Math.round(((current - previous) / previous) * 100);
  return { kind: percent > 0 ? 'up' : percent < 0 ? 'down' : 'same', percent };
}

/** « +12 % », « −8 % », « 0 % » (signe moins typographique). */
export function formatPercent(percent: number): string {
  if (percent > 0) return `+${percent} %`;
  if (percent < 0) return `−${Math.abs(percent)} %`;
  return '0 %';
}

/** Spec 008, R8 : titre des indicateurs, selon la période choisie dans les filtres du graphique. */
export function summaryTitle(query: { bucket: TimelineBucket; year: number; month: number; day: number }): string {
  const month = MONTH_NAMES[query.month - 1].toLowerCase();
  switch (query.bucket) {
    case 'hour':
      return `Indicateurs du ${query.day === 1 ? '1er' : query.day} ${month} ${query.year}`;
    case 'day':
      return `Indicateurs ${/^[aeiouy]/.test(month) ? 'd’' : 'de '}${month} ${query.year}`;
    case 'month':
      return `Indicateurs de ${query.year}`;
  }
}

/** Part des demandes en retard, en pourcentage entier (comme la page « Rapport »). */
export function lateShare(late: number, total: number): number {
  return total > 0 ? Math.round((late / total) * 100) : 0;
}
