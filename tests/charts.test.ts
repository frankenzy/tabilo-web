import { describe, expect, it } from 'vitest';
import { CHART_KINDS, cumulate, heatIntensity, isChartKind, maxValue, TOTAL_KEY } from '@/components/ui/charts/chart-logic';

const series = [
  { key: 'onTime', label: 'Dans les délais', color: '#00f' },
  { key: 'late', label: 'En retard', color: '#f00' },
];

describe('Spec 011 — types de graphique', () => {
  it('R2 — cinq types : barres, courbes, carte thermique, aires empilées, courbe cumulée', () => {
    expect(CHART_KINDS.map((k) => k.label)).toEqual(['Barres', 'Courbes', 'Carte thermique', 'Aires empilées', 'Courbe cumulée']);
    expect(isChartKind('area')).toBe(true);
    expect(isChartKind('pie')).toBe(false);
  });

  it('CA-011-02 — la courbe cumulée additionne chaque série et le total', () => {
    const rows = [
      { label: '12 h', onTime: 2, late: 1 },
      { label: '13 h', onTime: 4, late: 1 },
      { label: '14 h', onTime: 2, late: 0 },
    ];
    const cumulated = cumulate(rows, series);
    expect(cumulated.map((r) => r[TOTAL_KEY])).toEqual([3, 8, 10]);
    expect(cumulated.map((r) => r.onTime)).toEqual([2, 6, 8]);
    expect(cumulated.map((r) => r.late)).toEqual([1, 2, 2]);
  });

  it('CA-011-03 — carte thermique : intensité relative à la plus forte valeur', () => {
    const rows = [
      { label: 'a', onTime: 0, late: 2 },
      { label: 'b', onTime: 8, late: 4 },
    ];
    const max = maxValue(rows, series);
    expect(max).toBe(8);
    expect(heatIntensity(8, max)).toBe(1);
    expect(heatIntensity(4, max)).toBe(0.5);
    expect(heatIntensity(0, max)).toBe(0);
    expect(heatIntensity(3, 0)).toBe(0);
  });
});
