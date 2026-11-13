'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type CSSProperties } from 'react';
import { RequestCard, type Viewer } from '@/components/pages/requests/request-card';
import { RequestDialogs, type RequestDialog } from '@/components/pages/requests/request-dialogs';
import { TableRequestsDialog } from '@/components/pages/requests/table-requests-dialog';
import { PrecisionFlags, precisionLabel } from '@/components/pages/requests/precisions';
import { SalesRow } from './sales-row';
import { TodaySection } from './today-charts';
import { useActiveRequests, useFloor, useRequestAction } from '@/components/pages/requests/use-requests';
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui';
import { requestIcon } from '@/constants/requests';
import type { ServiceRequest, Table } from '@/contracts';
import { estKey, useEstablishmentId, useLiveRefetchInterval } from '@/hooks/use-establishment';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';
import { analyticsApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useAuthStore, useMembership } from '@/stores/auth.store';
import { formatClock, formatDuration, secondsSince } from '@/utils/time';
import { URGENCY_TILE, urgencyOf, worstUrgency } from '@/utils/urgency';

export function DashboardPage() {
  const establishmentId = useEstablishmentId();
  const refetchInterval = useLiveRefetchInterval();
  const me = useAuthStore((state) => state.me);
  const membership = useMembership();
  const now = useNow();
  const live = useQuery({
    queryKey: estKey(establishmentId, 'live'),
    queryFn: () => analyticsApi.live(establishmentId),
    refetchInterval: Math.min(refetchInterval, 30_000),
  });
  const active = useActiveRequests();
  const floor = useFloor();
  const action = useRequestAction();
  const [dialog, setDialog] = useState<RequestDialog>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  // Filtre de zone du plan de salle (« Toutes les zones » par défaut).
  const [areaId, setAreaId] = useState<string>('all');
  const planTables = useMemo(
    () => (floor.data ?? []).filter((area) => areaId === 'all' || area.id === areaId).flatMap((area) => area.tables),
    [floor.data, areaId],
  );

  const viewer: Viewer = useMemo(
    () => ({ id: me?.id ?? '', can: (permission) => membership?.permissions.includes(permission) ?? false }),
    [me, membership],
  );
  const requests = useMemo(() => active.data?.items ?? [], [active.data]);
  const byTable = useMemo(() => {
    const map = new Map<string, ServiceRequest[]>();
    requests.forEach((r) => map.set(r.table.id, [...(map.get(r.table.id) ?? []), r]));
    return map;
  }, [requests]);
  const attention = requests.filter((r) => r.escalationStatus === 'escalated' || urgencyOf(r, now) === 'late');
  const selectedTable = floor.data?.flatMap((area) => area.tables).find((table) => table.id === tableId) ?? null;

  if (live.isPending || active.isPending || floor.isPending) return <Spinner />;
  if (live.isError || active.isError || floor.isError) {
    return (
      <ErrorState
        message={errorMessage(live.error ?? active.error ?? floor.error)}
        onRetry={() => {
          void live.refetch();
          void active.refetch();
          void floor.refetch();
        }}
      />
    );
  }

  const stats = live.data;
  const card = (request: ServiceRequest) => (
    <RequestCard
      request={request}
      now={now}
      viewer={viewer}
      busy={action.isPending && action.variables?.id === request.id}
      onAction={(name) => action.mutate({ id: request.id, action: name })}
      onDialog={setDialog}
    />
  );

  return (
    <>
      <PageHeader title="Tableau de bord" description="La salle, en ce moment." />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat index={0} label="En attente" value={stats.pending + stats.assigned} hint={stats.oldestPendingSeconds ? `plus ancienne : ${formatDuration(stats.oldestPendingSeconds)}` : 'aucune attente'} />
        <Stat index={1} label="Prises en charge" value={stats.accepted + stats.inProgress} hint={`${stats.inProgress} en cours de traitement`} />
        <Stat index={2} label="En retard" value={stats.late} tone={stats.late > 0 ? 'late' : undefined} hint="délai cible dépassé" />
        <Stat index={3} label="Escaladées" value={stats.escalated} tone={stats.escalated > 0 ? 'late' : undefined} hint="à acquitter" />
        <Stat index={4} className="col-span-2 sm:col-span-1" label="Prise en charge médiane" value={formatDuration(stats.today.medianAcceptSeconds)} hint={`aujourd’hui · ${stats.today.total} demandes`} />
      </dl>

      <SalesRow />
      <TodaySection />

      {/* Plan de salle sur deux tiers de la ligne, priorités et équipe sur le tiers restant. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <section aria-labelledby="floor-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="floor-title" className="text-[15px] font-semibold text-ink">
                Plan de salle
              </h2>
              {floor.data.length > 1 && (
                <label className="relative">
                  <span className="sr-only">Zone</span>
                  <select
                    value={areaId}
                    onChange={(event) => setAreaId(event.target.value)}
                    className="h-9 appearance-none rounded-lg bg-surface pr-8 pl-3 text-[13px] font-medium text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="all">Toutes les zones</option>
                    {floor.data.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-2" aria-hidden />
                </label>
              )}
            </div>
            <div className="mt-2">
              <Legend />
            </div>
            {floor.data.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="Aucune table configurée"
                  description="Créez vos zones et vos tables pour générer les QR codes."
                  action={
                    <Link href="/app/tables" className="text-sm font-medium text-ink underline underline-offset-4">
                      Configurer la salle
                    </Link>
                  }
                />
              </div>
            ) : planTables.length === 0 ? (
              <p className="mt-4 text-sm text-ink-3">Aucune table dans cette zone.</p>
            ) : (
              // Toutes les zones ensemble, dans l'ordre des zones puis des tables ; carrés compacts.
              <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10">
                {planTables.map((table, index) => (
                  <li key={table.id} className="stagger animate-item-in" style={{ '--i': Math.min(index, 20) } as CSSProperties}>
                    <TableTile table={table} requests={byTable.get(table.id) ?? []} now={now} onOpen={() => setTableId(table.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Card>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="attention-title">
            <h2 id="attention-title" className="text-[15px] font-semibold text-ink">
              À traiter en priorité
            </h2>
            {attention.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 rounded-(--radius-card) bg-done-soft px-4 py-3 text-sm text-done">
                <ShieldCheck className="size-4" aria-hidden />
                Aucune demande en retard ni escaladée.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {attention.map((request) => (
                  <li key={request.id}>{card(request)}</li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="team-title">
            <h2 id="team-title" className="text-[15px] font-semibold text-ink">
              Qui traite quoi
            </h2>
            {stats.staff.length === 0 ? (
              <p className="mt-3 text-sm text-ink-2">Aucun membre habilité à traiter des demandes.</p>
            ) : (
              <Card className="mt-3 divide-y divide-line">
                {stats.staff.map((member) => {
                  const total = member.assigned + member.accepted + member.inProgress;
                  return (
                    <div key={member.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="truncate text-sm font-medium text-ink">
                        {member.firstName} {member.lastName}
                      </span>
                      <span className="tabular shrink-0 text-[13px] text-ink-2">
                        {total === 0 ? 'Disponible' : `${total} demande${total > 1 ? 's' : ''} · ${member.inProgress} en cours`}
                      </span>
                    </div>
                  );
                })}
              </Card>
            )}
          </section>
        </div>
      </div>

      {selectedTable && (
        <TableRequestsDialog
          table={selectedTable}
          areaName={floor.data?.find((area) => area.tables.some((table) => table.id === selectedTable.id))?.name}
          status={selectedTable.openSessions > 0 || (byTable.get(selectedTable.id)?.length ?? 0) > 0 ? 'occupied' : 'free'}
          requests={byTable.get(selectedTable.id) ?? []}
          canClose={viewer.can('sessions.manage')}
          onClose={() => setTableId(null)}
        >
          {(request) => card(request)}
        </TableRequestsDialog>
      )}
      <RequestDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function Stat({ label, value, hint, tone, className, index = 0 }: { label: string; value: number | string; hint: string; tone?: 'late'; className?: string; index?: number }) {
  return (
    <div
      className={cn('stagger flex animate-item-in flex-col justify-between gap-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line sm:p-5', className)}
      style={{ '--i': index } as CSSProperties}
    >
      <dt className="text-[15px] font-medium text-ink">{label}</dt>
      <div>
        <dd className={cn('tabular overflow-hidden text-3xl leading-none font-semibold tracking-tight', tone === 'late' ? 'text-late' : 'text-ink')}>
          {/* Nouvelle valeur : elle monte en fondu (la clé relance l'animation). */}
          <span key={String(value)} className="inline-block animate-number-in">
            {value}
          </span>
        </dd>
        <dd className="mt-1.5 text-xs text-ink-3">{hint}</dd>
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { label: 'Nouvelle', className: 'bg-calm ring-1 ring-line' },
    { label: 'En attente', className: 'bg-wait' },
    { label: 'En retard', className: 'bg-late' },
    { label: 'Prise en charge', className: 'bg-progress-soft ring-1 ring-progress/30' },
    { label: 'Prête', className: 'bg-done' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2" aria-label="Légende">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-sm', item.className)} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function TableTile({ table, requests, now, onOpen }: { table: Table; requests: ServiceRequest[]; now: number; onOpen: () => void }) {
  const urgency = worstUrgency(requests.map((r) => urgencyOf(r, now)));
  const oldest = requests.reduce<ServiceRequest | null>((min, r) => (!min || r.createdAt < min.createdAt ? r : min), null);
  const escalated = requests.some((r) => r.escalationStatus === 'escalated');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Table ${table.label}, ${requests.length} demande${requests.length > 1 ? 's' : ''} en cours${precisionLabel(requests.map((request) => request.note).filter(Boolean).join(' · ') || null)}`}
      className={cn(
        'relative flex aspect-square w-full flex-col items-center justify-center rounded-lg p-0.5 text-center transition-transform duration-200 ease-apple hover:scale-[1.04] active:scale-95',
        urgency ? URGENCY_TILE[urgency] : 'bg-surface text-ink-2 ring-1 ring-line ring-inset',
        escalated && 'animate-attention',
      )}
    >
      {/* Spec 022, R5 : une demande en cours porte une précision (à emporter, piment). */}
      <PrecisionFlags notes={requests.map((request) => request.note)} size="sm" className="absolute -top-1.5 -right-1.5 drop-shadow-sm" />
      <span className="tabular max-w-full truncate font-mono text-base leading-none font-semibold">{table.label}</span>
      {oldest ? (
        <>
          <span className="mt-1 flex gap-0.5" aria-hidden>
            {requests.slice(0, 3).map((request) => {
              const Icon = requestIcon(request.type.icon);
              return <Icon key={request.id} className="size-3" />;
            })}
          </span>
          <span className="tabular mt-0.5 font-mono text-[10px] leading-none opacity-80">{formatClock(secondsSince(oldest.createdAt, now))}</span>
        </>
      ) : (
        table.openSessions > 0 && <Smartphone className="mt-1 size-3 text-ink-3" aria-label="Client connecté" />
      )}
    </button>
  );
}
