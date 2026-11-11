'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { RequestCard, type Viewer } from '@/components/pages/requests/request-card';
import { RequestDialogs, type RequestDialog } from '@/components/pages/requests/request-dialogs';
import { useActiveRequests, useFloor, useRequestAction } from '@/components/pages/requests/use-requests';
import { Button, Card, Dialog, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui';
import { requestIcon } from '@/constants/requests';
import type { ServiceRequest, Table } from '@/contracts';
import { estKey, useEstablishmentId, useLiveRefetchInterval } from '@/hooks/use-establishment';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';
import { analyticsApi, floorApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useAuthStore, useMembership } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
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

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="En attente" value={stats.pending + stats.assigned} hint={stats.oldestPendingSeconds ? `plus ancienne : ${formatDuration(stats.oldestPendingSeconds)}` : 'aucune attente'} />
        <Stat label="Prises en charge" value={stats.accepted + stats.inProgress} hint={`${stats.inProgress} en cours de traitement`} />
        <Stat label="En retard" value={stats.late} tone={stats.late > 0 ? 'late' : undefined} hint="délai cible dépassé" />
        <Stat label="Escaladées" value={stats.escalated} tone={stats.escalated > 0 ? 'late' : undefined} hint="à acquitter" />
        <Stat label="Prise en charge médiane" value={formatDuration(stats.today.medianAcceptSeconds)} hint={`aujourd’hui · ${stats.today.total} demandes`} />
      </dl>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="floor-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="floor-title" className="text-[15px] font-semibold text-ink">
              Plan de salle
            </h2>
            <Legend />
          </div>
          {floor.data.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="Aucune table configurée"
                description="Créez vos zones et vos tables pour générer les QR codes."
                action={
                  <Link href="/app/salle" className="text-sm font-medium text-ink underline underline-offset-4">
                    Configurer la salle
                  </Link>
                }
              />
            </div>
          ) : (
            floor.data.map((area) => (
              <div key={area.id} className="mt-4">
                <h3 className="text-[13px] font-medium text-ink-3">{area.name}</h3>
                {area.tables.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-3">Aucune table dans cette zone.</p>
                ) : (
                  <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                    {area.tables.map((table) => (
                      <li key={table.id}>
                        <TableTile table={table} requests={byTable.get(table.id) ?? []} now={now} onOpen={() => setTableId(table.id)} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </section>

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
        <TableDialog table={selectedTable} requests={byTable.get(selectedTable.id) ?? []} canClose={viewer.can('sessions.manage')} onClose={() => setTableId(null)}>
          {(request) => card(request)}
        </TableDialog>
      )}
      <RequestDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number | string; hint: string; tone?: 'late' }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className={cn('tabular mt-1 text-3xl leading-none font-semibold tracking-tight', tone === 'late' ? 'text-late' : 'text-ink')}>{value}</dd>
      <dd className="mt-1.5 text-xs text-ink-3">{hint}</dd>
    </div>
  );
}

function Legend() {
  const items = [
    { label: 'Nouvelle', className: 'bg-calm ring-1 ring-line' },
    { label: 'En attente', className: 'bg-wait' },
    { label: 'En retard', className: 'bg-late' },
    { label: 'Prise en charge', className: 'bg-progress-soft ring-1 ring-progress/30' },
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
      aria-label={`Table ${table.label}, ${requests.length} demande${requests.length > 1 ? 's' : ''} en cours`}
      className={cn(
        'flex aspect-square w-full flex-col items-center justify-center rounded-xl p-1 text-center transition-transform active:scale-95',
        urgency ? URGENCY_TILE[urgency] : 'bg-surface text-ink-2 ring-1 ring-line ring-inset',
        escalated && 'animate-attention',
      )}
    >
      <span className="tabular max-w-full truncate font-mono text-xl leading-none font-semibold">{table.label}</span>
      {oldest ? (
        <>
          <span className="mt-1.5 flex gap-1" aria-hidden>
            {requests.slice(0, 3).map((request) => {
              const Icon = requestIcon(request.type.icon);
              return <Icon key={request.id} className="size-3.5" />;
            })}
          </span>
          <span className="tabular mt-1 font-mono text-[11px] opacity-80">{formatClock(secondsSince(oldest.createdAt, now))}</span>
        </>
      ) : (
        table.openSessions > 0 && <Smartphone className="mt-1.5 size-3.5 text-ink-3" aria-label="Client connecté" />
      )}
    </button>
  );
}

function TableDialog({
  table, requests, canClose, onClose, children,
}: { table: Table; requests: ServiceRequest[]; canClose: boolean; onClose: () => void; children: (request: ServiceRequest) => React.ReactNode }) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const close = useMutation({
    mutationFn: () => floorApi.closeSessions(establishmentId, table.id),
    onSuccess: ({ closed }) => {
      toast.success(closed > 0 ? `${closed} session${closed > 1 ? 's' : ''} fermée${closed > 1 ? 's' : ''}` : 'Aucune session ouverte');
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'floor') });
    },
    onError: (error) => toast.error('Fermeture impossible', errorMessage(error)),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`Table ${table.label}`} description={`${table.seats} couverts · ${table.openSessions} téléphone${table.openSessions > 1 ? 's' : ''} connecté${table.openSessions > 1 ? 's' : ''}`} variant="sheet">
      {requests.length === 0 ? (
        <p className="text-sm text-ink-2">Aucune demande en cours sur cette table.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id}>{children(request)}</li>
          ))}
        </ul>
      )}
      {canClose && table.openSessions > 0 && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-[13px] text-ink-2">Les clients sont partis ? Fermez leurs sessions : leurs téléphones ne pourront plus envoyer de demande pour cette table.</p>
          <Button variant="secondary" className="mt-3" loading={close.isPending} onClick={() => close.mutate()}>
            Fermer les sessions
          </Button>
        </div>
      )}
    </Dialog>
  );
}
