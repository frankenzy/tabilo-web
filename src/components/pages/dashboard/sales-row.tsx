'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Clock, HandCoins, Minus, RotateCw, TrendingDown, TrendingUp, UserX, Wallet, type LucideIcon } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { useSlidingIndicator } from '@/components/ui';
import type { SalesPeriod } from '@/contracts';
import { estKey, useEstablishmentId, useLiveRefetchInterval } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { analyticsApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { formatMoney } from '@/utils/money';
import { formatPercent, salesTrend, type SalesTrend } from './today-logic';
import { WrittenOffDialog } from './unpaid-alerts';

const PERIODS: { value: SalesPeriod; label: string; previous: string }[] = [
  { value: 'month', label: 'Mensuel', previous: 'au mois dernier' },
  { value: 'year', label: 'Annuel', previous: 'à l’année dernière' },
];

/** Spec 024, R3 et spec 026, R7 : filtre Mensuel · Annuel de la rangée « Caisse », en haut à droite de la page. */
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
 * Spec 026, R7 : rangée « Caisse » — Total servi (règles de la spec 009), Total encaissé (daté du règlement)
 * et Reste à encaisser (toutes dates). Les deux premiers suivent le filtre Mensuel · Annuel.
 * Spec 027, R13 : quatrième carte « Impayés » (période), qui ouvre la liste des clients partis sans payer.
 */
export function CashCards({ period, index = 0 }: { period: SalesPeriod; index?: number }) {
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
  const money = (minor: number) => (data ? formatMoney(minor, data.currency) : '');
  const failed = sales.isError && !data;
  const common = { faded: sales.isPlaceholderData, failed, onRetry: () => void sales.refetch(), error: failed ? errorMessage(sales.error) : undefined };
  const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;
  const outstanding = data?.outstanding;
  const [listOpen, setListOpen] = useState(false);
  const writtenOff = data?.current.writtenOffMinor ?? 0;
  const customers = data?.current.writtenOffCustomers ?? 0;

  return (
    <>
      <MoneyCard
        {...common}
        index={index}
        icon={Wallet}
        label="Total servi"
        amount={data ? money(data.current.totalMinor) : null}
        detail={data ? `${plural(data.current.orders, 'commande')} servie${data.current.orders > 1 ? 's' : ''}` : ''}
        trend={data ? salesTrend(data.current.totalMinor, data.previous.totalMinor) : { kind: 'none' }}
        previousLabel={previousLabel}
      />
      <MoneyCard
        {...common}
        index={index + 1}
        icon={HandCoins}
        label="Total encaissé"
        amount={data ? money(data.current.paidMinor) : null}
        detail={data ? `${plural(data.current.paidOrders, 'commande')} réglée${data.current.paidOrders > 1 ? 's' : ''}` : ''}
        trend={data ? salesTrend(data.current.paidMinor, data.previous.paidMinor) : { kind: 'none' }}
        previousLabel={previousLabel}
      />
      <MoneyCard
        {...common}
        index={index + 2}
        icon={Clock}
        label="Reste à encaisser"
        amount={outstanding ? money(outstanding.amountMinor) : null}
        alert={(outstanding?.amountMinor ?? 0) > 0}
        detail={outstanding ? (outstanding.orders === 0 ? 'Tout est réglé' : `${plural(outstanding.orders, 'commande')} · ${plural(outstanding.tables, 'table')}`) : ''}
        trend={{ kind: 'none' }}
      />
      <MoneyCard
        {...common}
        index={index + 3}
        icon={UserX}
        label="Impayés"
        amount={data ? money(writtenOff) : null}
        alert={writtenOff > 0}
        detail={data ? (customers === 0 ? 'Aucun départ sans payer' : plural(customers, 'client')) : ''}
        trend={data ? salesTrend(writtenOff, data.previous.writtenOffMinor ?? 0) : { kind: 'none' }}
        previousLabel={previousLabel}
        onOpen={() => setListOpen(true)}
        openLabel="Voir les impayés"
      />
      <WrittenOffDialog period={period} currency={data?.currency ?? 'XOF'} open={listOpen} onOpenChange={setListOpen} />
    </>
  );
}

function MoneyCard({
  index, icon: Icon, label, amount, detail, trend, previousLabel, alert = false, faded, failed, error, onRetry, onOpen, openLabel,
}: {
  index: number;
  icon: LucideIcon;
  label: string;
  amount: string | null;
  detail: string;
  trend: SalesTrend;
  /** Absent : pas de comparaison (Reste à encaisser). */
  previousLabel?: string;
  alert?: boolean;
  faded: boolean;
  failed: boolean;
  error?: string;
  onRetry: () => void;
  /** Carte ouvrable (spec 027, R13 : liste des impayés). */
  onOpen?: () => void;
  openLabel?: string;
}) {
  const style = trend.kind === 'none' ? null : TREND_STYLE[trend.kind];
  const shown = failed ? '—' : amount;
  return (
    <div
      className={cn(
        'stagger relative flex min-w-0 animate-item-in flex-col justify-between gap-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line transition-opacity duration-300 ease-apple sm:p-5',
        faded && 'opacity-60',
        onOpen && 'transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg',
      )}
      style={{ '--i': index } as CSSProperties}
    >
      {onOpen && <button type="button" onClick={onOpen} aria-label={openLabel ?? label} className="absolute inset-0 z-10 rounded-(--radius-card)" />}
      <div className="flex items-start justify-between gap-2">
        <dt className="text-[15px] font-medium text-ink">{label}</dt>
        <Icon className={cn('size-5 shrink-0', alert ? 'text-late' : 'text-ink-3')} aria-hidden />
      </div>
      <div className="min-w-0">
        <dd className={cn('tabular text-lg leading-tight font-semibold tracking-tight sm:text-3xl', alert ? 'text-late' : 'text-ink')}>
          {shown === null ? (
            <span className="inline-block h-8 w-28 animate-pulse rounded-md bg-sunken align-middle" aria-label="Chargement" />
          ) : (
            <span key={shown} className="inline-block animate-number-in">
              {shown}
            </span>
          )}
        </dd>
        <dd className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-3">
          {failed ? (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-late" title={error}>
              <RotateCw className="size-3.5" aria-hidden />
              Réessayer
            </button>
          ) : (
            amount !== null && (
              <>
                <span>{detail}</span>
                {previousLabel &&
                  (style && trend.kind !== 'none' ? (
                    <span className={cn('inline-flex items-center gap-0.5 font-semibold', style.className)}>
                      <style.icon className="size-3.5" aria-hidden />
                      {formatPercent(trend.percent)}
                      <span className="font-normal text-ink-3"> vs {previousLabel.replace(/^(au|à l’)/, '').trim()}</span>
                    </span>
                  ) : (
                    <span>Rien {previousLabel}</span>
                  ))}
              </>
            )
          )}
        </dd>
      </div>
    </div>
  );
}
