import { describe, expect, it } from 'vitest';
import { BUCKETS, clampDay, formatPercent, lateShare, salesTrend, summaryTitle, daysInMonth, hourTotal, periodLabel, RANK_COLORS, todayIn, trendHint, trendOf } from '@/components/pages/dashboard/today-logic';

describe('Spec 008 — tableau de bord du jour', () => {
  it('CA-008-03 — la flèche compare au rang d’hier à la même heure', () => {
    expect(trendOf(1, 2)).toBe('up');
    expect(trendOf(2, 1)).toBe('down');
    expect(trendOf(2, 2)).toBe('same');
    expect(trendOf(3, null)).toBe('new');
    expect(trendHint(3)).toBe('3e hier à la même heure');
    expect(trendHint(1)).toBe('1er hier à la même heure');
    expect(trendHint(null)).toBe('Pas commandé hier à cette heure');
  });

  it('R4 — rangs or, argent, bronze', () => {
    expect([1, 2, 3].map((rank) => RANK_COLORS[rank].name)).toEqual(['Or', 'Argent', 'Bronze']);
  });

  it('R2 — le total d’une heure additionne tous les états', () => {
    expect(hourTotal({ waiting: 1, progress: 2, ready: 1, resolved: 4, cancelled: 1 })).toBe(9);
  });

  it('CA-008-06 — découpage Mois / Jour / Heure, avec les filtres de date qu’il demande', () => {
    expect(BUCKETS.map((b) => [b.label, b.filters])).toEqual([
      ['Mois', ['year']],
      ['Jour', ['year', 'month']],
      ['Heure', ['year', 'month', 'day']],
    ]);
    expect(periodLabel('2026-11-13T14:00', 'hour')).toBe('14 h');
    expect(periodLabel('2026-11-03T00:00', 'day')).toBe('3');
    expect(periodLabel('2026-09-01T00:00', 'month')).toBe('sept.');
  });

  it('CA-008-06 — date du jour par défaut, jamais de jour impossible', () => {
    expect(todayIn('Africa/Abidjan', new Date('2026-11-13T23:30:00Z'))).toEqual({ year: 2026, month: 11, day: 13 });
    expect(todayIn('Asia/Tokyo', new Date('2026-11-13T23:30:00Z'))).toEqual({ year: 2026, month: 11, day: 14 });
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(clampDay(2026, 2, 31)).toBe(28);
    expect(clampDay(2026, 4, 31)).toBe(30);
    expect(clampDay(2026, 5, 31)).toBe(31);
  });

  it('CA-009-03 — évolution en pourcentage par rapport à la période précédente', () => {
    expect(salesTrend(12000, 10000)).toEqual({ kind: 'up', percent: 20 });
    expect(salesTrend(9200, 10000)).toEqual({ kind: 'down', percent: -8 });
    expect(salesTrend(10000, 10000)).toEqual({ kind: 'same', percent: 0 });
    expect(salesTrend(5000, 0)).toEqual({ kind: 'none' });
    expect(salesTrend(null, 4000)).toEqual({ kind: 'none' });
    expect([formatPercent(20), formatPercent(-8), formatPercent(0)]).toEqual(['+20 %', '−8 %', '0 %']);
  });

  it('CA-008-07 — titre des indicateurs selon la période, part en retard arrondie', () => {
    expect(summaryTitle({ bucket: 'hour', year: 2026, month: 11, day: 13 })).toBe('Indicateurs du 13 novembre 2026');
    expect(summaryTitle({ bucket: 'hour', year: 2026, month: 11, day: 1 })).toBe('Indicateurs du 1er novembre 2026');
    expect(summaryTitle({ bucket: 'day', year: 2026, month: 11, day: 13 })).toBe('Indicateurs de novembre 2026');
    expect(summaryTitle({ bucket: 'day', year: 2026, month: 8, day: 1 })).toBe('Indicateurs d’août 2026');
    expect(summaryTitle({ bucket: 'month', year: 2026, month: 11, day: 13 })).toBe('Indicateurs de 2026');
    expect(lateShare(1, 3)).toBe(33);
    expect(lateShare(0, 0)).toBe(0);
  });
});
