'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandCoins, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button, Dialog } from '@/components/ui';
import { SessionMarker } from '@/components/ui/session-marker';
import type { SalesPeriod, UnpaidAlert, UnpaidAlertResolution } from '@/contracts';
import { markerInfo } from '@/contracts/session-markers';
import { estKey, useEstablishmentId, useLiveRefetchInterval } from '@/hooks/use-establishment';
import { useNow } from '@/hooks/use-now';
import { analyticsApi, unpaidAlertsApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';
import { formatMoney } from '@/utils/money';
import { formatTime } from '@/utils/time';
import { sinceLabel } from './alerts-logic';

const REASON: Record<UnpaidAlert['reason'], string> = {
  inactivity: 'non réglé',
  released: 'table libérée sans règlement',
  expired: 'session expirée sans règlement',
};


/**
 * Spec 027, R9 : alertes de départ sans payer, en tête du tableau de bord.
 * Trois actions : « Réglé » (oubli de saisie), « Client encore là », « Parti sans payer ».
 */
export function UnpaidAlertsPanel({ currency }: { currency: string }) {
  const establishmentId = useEstablishmentId();
  const refetchInterval = useLiveRefetchInterval();
  const queryClient = useQueryClient();
  const now = useNow(30_000);
  // Clé sous « today » : invalidée par le temps réel (alert.changed) avec la caisse.
  const alerts = useQuery({
    queryKey: estKey(establishmentId, 'today', 'unpaid-alerts'),
    queryFn: () => unpaidAlertsApi.list(establishmentId),
    refetchInterval: Math.min(refetchInterval, 60_000),
  });
  const resolve = useMutation({
    mutationFn: ({ alert, resolution }: { alert: UnpaidAlert; resolution: UnpaidAlertResolution }) => unpaidAlertsApi.resolve(establishmentId, alert.id, resolution),
    onSuccess: (_, { alert, resolution }) => {
      const who = `Table ${alert.table.label} · ${markerInfo(alert.marker).name}`;
      if (resolution === 'paid') toast.success('Réglé', who);
      else if (resolution === 'walked_out') toast.info('Compté en impayé', who);
      else toast.info('Alerte suspendue', who);
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'today') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
    },
    onError: (error) => {
      toast.error('Action impossible', errorMessage(error));
      void alerts.refetch();
    },
  });

  const list = alerts.data ?? [];
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="unpaid-alerts-title" className="mb-4 animate-item-in rounded-(--radius-card) bg-late-soft p-4 ring-1 ring-late/25 sm:p-5">
      <h2 id="unpaid-alerts-title" className="flex items-center gap-2 text-[15px] font-semibold text-late">
        <ShieldAlert className="size-5" aria-hidden />
        {list.length > 1 ? `${list.length} clients n’ont pas réglé` : 'Un client n’a pas réglé'}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {list.map((alert, index) => {
          const name = markerInfo(alert.marker).name;
          const busy = resolve.isPending && resolve.variables?.alert.id === alert.id;
          const act = (resolution: UnpaidAlertResolution) => resolve.mutate({ alert, resolution });
          return (
            <li
              key={alert.id}
              className="stagger flex animate-item-in flex-col gap-3 rounded-xl bg-surface p-3 ring-1 ring-line sm:flex-row sm:items-center"
              style={{ '--i': index } as CSSProperties}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <SessionMarker index={alert.marker} size="md" decorative />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">
                    Table {alert.table.label} · <span className="font-medium">{name}</span>
                  </p>
                  <p className="text-[13px] text-ink-2">
                    <span className="tabular font-semibold text-late">{formatMoney(alert.amountMinor, currency)}</span> {REASON[alert.reason]} {sinceLabel(alert.lastActivityAt, now)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => act('paid')}>
                  <HandCoins className="size-4" aria-hidden />
                  Réglé
                </Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => act('still_here')}>
                  <UserCheck className="size-4" aria-hidden />
                  Encore là
                </Button>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => act('walked_out')}>
                  <UserX className="size-4" aria-hidden />
                  Parti
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Spec 027, R13 : liste des clients partis sans payer pendant la période (ouverte depuis la carte « Impayés »). */
export function WrittenOffDialog({ period, currency, open, onOpenChange }: { period: SalesPeriod; currency: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const establishmentId = useEstablishmentId();
  const list = useQuery({
    queryKey: estKey(establishmentId, 'today', 'written-off', period),
    queryFn: () => analyticsApi.unpaid(establishmentId, period),
    enabled: open,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Impayés" description={period === 'month' ? 'Ce mois-ci' : 'Cette année'}>
      {list.isPending ? (
        <p className="py-6 text-center text-sm text-ink-3">Chargement…</p>
      ) : list.isError ? (
        <p role="alert" className="py-6 text-center text-sm text-late">
          {errorMessage(list.error)}
        </p>
      ) : list.data.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">Aucun impayé sur la période.</p>
      ) : (
        <ul className="flex flex-col">
          {list.data.map((row) => (
            <li key={`${row.sessionId ?? row.writtenOffAt}-${row.table.id}`} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              {row.marker !== null ? <SessionMarker index={row.marker} size="md" /> : <span className="size-8" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">
                  Table {row.table.label}
                  {row.marker !== null && <span className="font-medium text-ink-2"> · {markerInfo(row.marker).name}</span>}
                </p>
                <p className="text-[12px] text-ink-3">
                  {new Date(row.writtenOffAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {formatTime(row.writtenOffAt)}
                  {row.writtenOffBy && ` · ${row.writtenOffBy}`}
                </p>
              </div>
              <span className="tabular shrink-0 text-[15px] font-semibold text-late">{formatMoney(row.amountMinor, currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
