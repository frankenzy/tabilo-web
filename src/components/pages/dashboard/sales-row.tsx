'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Armchair, Minus, TrendingDown, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { ErrorState, useSlidingIndicator } from '@/components/ui';
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

/**
 * Spec 009 : entre les indicateurs et le graphique, « Total vendu » et « Moyenne par table »
 * sur le mois ou l'année en cours, avec le filtre Mensuel · Annuel à droite sur la même ligne.
 */
export function SalesRow() {
  const establishmentId = useEstablishmentId();
  const refetchInterval = useLiveRefetchInterval();
  const [period, setPeriod] = useState<SalesPeriod>('month');
  const segments = useSlidingIndicator(period);
  // Clé sous « today » : invalidée par le temps réel avec le reste du tableau de bord (R6).
  const sales = useQuery({
    queryKey: estKey(establishmentId, 'today', 'sales', period),
    queryFn: () => analyticsApi.sales(establishmentId, period),
    refetchInterval: Math.min(refetchInterval, 30_000),
    placeholderData: keepPreviousData,
  });
  const current = PERIODS.find((option) => option.value === period)!;

  return (
    <section aria-label="Ventes" className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start">
      <div
        ref={segments.container}
        role="tablist"
        aria-label="Période des ventes"
        className="relative flex gap-1 self-end rounded-lg bg-sunken p-1 lg:order-last lg:self-start"
      >
        {segments.indicator}
        {PERIODS.map((option) => (
          <button
            key={option.value}
            ref={segments.register(option.value)}
            type="button"
            role="tab"
            aria-selected={period === option.value}
            onClick={() => setPeriod(option.value)}
            className={cn(
              'relative rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-300',
              period === option.value ? 'text-ink' : 'text-ink-3 hover:text-ink',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {sales.isError ? (
        <div className="flex-1">
          <ErrorState message={errorMessage(sales.error)} onRetry={() => void sales.refetch()} />
        </div>
      ) : (
        <div className={cn('grid flex-1 grid-cols-2 gap-3 transition-opacity duration-300 ease-apple', sales.isPlaceholderData && 'opacity-60')}>
          <MoneyCard
            index={5}
            icon={Wallet}
            label="Total vendu"
            amount={sales.data ? formatMoney(sales.data.current.totalMinor, sales.data.currency) : null}
            detail={sales.data ? `${sales.data.current.orders} commande${sales.data.current.orders > 1 ? 's' : ''} servie${sales.data.current.orders > 1 ? 's' : ''}` : ''}
            trend={sales.data ? salesTrend(sales.data.current.totalMinor, sales.data.previous.totalMinor) : { kind: 'none' }}
            previousLabel={current.previous}
          />
          <MoneyCard
            index={6}
            icon={Armchair}
            label="Moyenne par table"
            amount={sales.data ? (sales.data.current.averageMinor === null ? '—' : formatMoney(sales.data.current.averageMinor, sales.data.currency)) : null}
            detail={sales.data ? `${sales.data.current.passages} passage${sales.data.current.passages > 1 ? 's' : ''} à table` : ''}
            trend={sales.data ? salesTrend(sales.data.current.averageMinor, sales.data.previous.averageMinor) : { kind: 'none' }}
            previousLabel={current.previous}
          />
        </div>
      )}
    </section>
  );
}

const TREND_STYLE: Record<Exclude<SalesTrend['kind'], 'none'>, { icon: LucideIcon; className: string }> = {
  up: { icon: TrendingUp, className: 'text-done' },
  down: { icon: TrendingDown, className: 'text-late' },
  same: { icon: Minus, className: 'text-ink-3' },
};

function MoneyCard({
  index, icon: Icon, label, amount, detail, trend, previousLabel,
}: { index: number; icon: LucideIcon; label: string; amount: string | null; detail: string; trend: SalesTrend; previousLabel: string }) {
  const style = trend.kind === 'none' ? null : TREND_STYLE[trend.kind];
  return (
    <div
      className="stagger flex min-w-0 animate-item-in flex-col justify-between gap-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line sm:p-5"
      style={{ '--i': index } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] font-medium text-ink">{label}</p>
        <Icon className="size-5 shrink-0 text-ink-3" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="tabular text-lg leading-tight font-semibold tracking-tight text-ink sm:text-3xl">
          {amount === null ? (
            <span className="inline-block h-8 w-28 animate-pulse rounded-md bg-sunken align-middle" aria-label="Chargement" />
          ) : (
            <span key={amount} className="inline-block animate-number-in">
              {amount}
            </span>
          )}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-3">
          <span>{detail}</span>
          {style && trend.kind !== 'none' ? (
            <span className={cn('inline-flex items-center gap-0.5 font-semibold', style.className)}>
              <style.icon className="size-3.5" aria-hidden />
              {formatPercent(trend.percent)}
              <span className="font-normal text-ink-3"> vs {previousLabel.replace(/^(au|à l’)/, '').trim()}</span>
            </span>
          ) : (
            amount !== null && <span>Pas de vente {previousLabel}</span>
          )}
        </p>
      </div>
    </div>
  );
}
