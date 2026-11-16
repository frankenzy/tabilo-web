'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Minus, RotateCw, TrendingDown, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useSlidingIndicator } from '@/components/ui';
import type { SalesPeriod } from '@/contracts';
import { estKey, useEstablishmentId, useLiveRefetchInterval } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { analyticsApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { formatMoney } from '@/utils/money';
import { formatPercent, salesTrend, type SalesTrend } from './today-logic';

const PERIODS: { value: SalesPeriod; label: string; previous: string }[] = [
  { value: 'month', label: 'Mensuel', previous: 'au mois dernier' },
  { value: 'year', label: 'Annuel', previous: 'à l’année dernière' },
];

/** Spec 024, R3 : filtre Mensuel · Annuel de « Total vendu », en haut à droite de la page. */
export function SalesPeriodFilter({ period, onChange }: { period: SalesPeriod; onChange: (period: SalesPeriod) => void }) {
  const segments = useSlidingIndicator(period);
  return (
    <div ref={segments.container} role="tablist" aria-label="Période des ventes" className="relative flex gap-1 rounded-lg bg-sunken p-1">
      {segments.indicator}
      {PERIODS.map((option) => (
        <button
          key={option.value}
          ref={segments.register(option.value)}
          type="button"
          role="tab"
          aria-selected={period === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'relative rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-300',
            period === option.value ? 'text-ink' : 'text-ink-3 hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const TREND_STYLE: Record<Exclude<SalesTrend['kind'], 'none'>, { icon: LucideIcon; className: string }> = {
  up: { icon: TrendingUp, className: 'text-done' },
  down: { icon: TrendingDown, className: 'text-late' },
  same: { icon: Minus, className: 'text-ink-3' },
};

/**
 * Spec 024, R3 (règles de la spec 009) : commandes servies du mois ou de l'année en cours,
 * comparées à la même durée de la période précédente.
 */
export function TotalSoldCard({ period, index = 0 }: { period: SalesPeriod; index?: number }) {
  const establishmentId = useEstablishmentId();
  const refetchInterval = useLiveRefetchInterval();
  // Clé sous « today » : invalidée par le temps réel avec le reste du tableau de bord (spec 009, R6).
  const sales = useQuery({
    queryKey: estKey(establishmentId, 'today', 'sales', period),
    queryFn: () => analyticsApi.sales(establishmentId, period),
    refetchInterval: Math.min(refetchInterval, 30_000),
    placeholderData: keepPreviousData,
  });
  const previousLabel = PERIODS.find((option) => option.value === period)!.previous;
  const data = sales.data;
  const amount = data ? formatMoney(data.current.totalMinor, data.currency) : sales.isError ? '—' : null;
  const trend: SalesTrend = data ? salesTrend(data.current.totalMinor, data.previous.totalMinor) : { kind: 'none' };
  const style = trend.kind === 'none' ? null : TREND_STYLE[trend.kind];

  return (
    <div
      className={cn(
        'stagger flex min-w-0 animate-item-in flex-col justify-between gap-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line transition-opacity duration-300 ease-apple sm:p-5',
        sales.isPlaceholderData && 'opacity-60',
      )}
      style={{ '--i': index } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <dt className="text-[15px] font-medium text-ink">Total vendu</dt>
        <Wallet className="size-5 shrink-0 text-ink-3" aria-hidden />
      </div>
      <div className="min-w-0">
        <dd className="tabular text-lg leading-tight font-semibold tracking-tight text-ink sm:text-3xl">
          {amount === null ? (
            <span className="inline-block h-8 w-28 animate-pulse rounded-md bg-sunken align-middle" aria-label="Chargement" />
          ) : (
            <span key={amount} className="inline-block animate-number-in">
              {amount}
            </span>
          )}
        </dd>
        <dd className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-3">
          {sales.isError && !data ? (
            <button type="button" onClick={() => void sales.refetch()} className="inline-flex items-center gap-1 text-late" title={errorMessage(sales.error)}>
              <RotateCw className="size-3.5" aria-hidden />
              Réessayer
            </button>
          ) : (
            data && (
              <>
                <span>
                  {data.current.orders} commande{data.current.orders > 1 ? 's' : ''} servie{data.current.orders > 1 ? 's' : ''}
                </span>
                {style && trend.kind !== 'none' ? (
                  <span className={cn('inline-flex items-center gap-0.5 font-semibold', style.className)}>
                    <style.icon className="size-3.5" aria-hidden />
                    {formatPercent(trend.percent)}
                    <span className="font-normal text-ink-3"> vs {previousLabel.replace(/^(au|à l’)/, '').trim()}</span>
                  </span>
                ) : (
                  <span>Pas de vente {previousLabel}</span>
                )}
              </>
            )
          )}
        </dd>
      </div>
    </div>
  );
}
