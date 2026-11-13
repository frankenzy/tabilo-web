/** Spec 011 : types de graphique et calculs purs (cumul, intensité de la carte thermique). */

export type ChartKind = 'bar' | 'line' | 'heatmap' | 'area' | 'cumulative';

export const CHART_KINDS: { value: ChartKind; label: string }[] = [
  { value: 'bar', label: 'Barres' },
  { value: 'line', label: 'Courbes' },
  { value: 'heatmap', label: 'Carte thermique' },
  { value: 'area', label: 'Aires empilées' },
  { value: 'cumulative', label: 'Courbe cumulée' },
];

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

export type ChartRow = { label: string } & Record<string, number | string>;

/** Clé de la série « Total » ajoutée par la courbe cumulée. */
export const TOTAL_KEY = '__total';

/** CA-011-02 : chaque série et le total s'additionnent période après période. */
export function cumulate(rows: ChartRow[], series: SeriesDef[]): ChartRow[] {
  const running: Record<string, number> = Object.fromEntries(series.map((s) => [s.key, 0]));
  let total = 0;
  return rows.map((row) => {
    const next: ChartRow = { label: row.label };
    for (const s of series) {
      const value = Number(row[s.key] ?? 0);
      running[s.key] += value;
      total += value;
      next[s.key] = running[s.key];
    }
    next[TOTAL_KEY] = total;
    return next;
  });
}

/** CA-011-03 : intensité d'une case de 0 (vide) à 1 (plus forte valeur du graphique). */
export function heatIntensity(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(1, value / max);
}

export function maxValue(rows: ChartRow[], series: SeriesDef[]): number {
  return rows.reduce((max, row) => Math.max(max, ...series.map((s) => Number(row[s.key] ?? 0))), 0);
}

export function isChartKind(value: unknown): value is ChartKind {
  return CHART_KINDS.some((kind) => kind.value === value);
}
