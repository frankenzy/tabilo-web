'use client';

import { CheckCheck, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RequestCard, type Viewer } from '@/components/pages/requests/request-card';
import { RequestDialogs, type RequestDialog } from '@/components/pages/requests/request-dialogs';
import { useActiveRequests, useRequestAction, useUnpaidOrders } from '@/components/pages/requests/use-requests';
import { Button, EmptyState, ErrorState, PageHeader, Spinner, Tabs } from '@/components/ui';
import type { ServiceRequest } from '@/contracts';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/http';
import { useAuthStore, useMembership } from '@/stores/auth.store';

type Tab = 'todo' | 'mine' | 'all' | 'unpaid';

/** Ordre de traitement : prioritaires d'abord, puis les plus anciennes. */
function byUrgency(a: ServiceRequest, b: ServiceRequest): number {
  if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
  return a.createdAt.localeCompare(b.createdAt);
}

export function ServicePage() {
  const me = useAuthStore((state) => state.me);
  const membership = useMembership();
  const { data, isPending, isError, error, refetch } = useActiveRequests();
  // Spec 026, R3 : commandes servies et non réglées.
  const unpaid = useUnpaidOrders();
  const action = useRequestAction();
  const now = useNow();
  const [tab, setTab] = useState<Tab>('todo');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<RequestDialog>(null);

  const viewer: Viewer = useMemo(
    () => ({ id: me?.id ?? '', can: (permission) => membership?.permissions.includes(permission) ?? false }),
    [me, membership],
  );

  const requests = useMemo(() => [...(data?.items ?? [])].sort(byUrgency), [data]);
  const groups = useMemo(
    () => ({
      todo: requests.filter((r) => r.status === 'pending' || (r.status === 'assigned' && r.assignee?.id === viewer.id)),
      mine: requests.filter((r) => r.assignee?.id === viewer.id && (r.status === 'accepted' || r.status === 'in_progress')),
      all: requests,
      unpaid: unpaid.data?.items ?? [],
    }),
    [requests, unpaid.data, viewer.id],
  );
  const areas = useMemo(() => {
    const map = new Map<string, string>();
    [...requests, ...(unpaid.data?.items ?? [])].forEach((r) => map.set(r.area.id, r.area.name));
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [requests, unpaid.data]);

  const visible = groups[tab].filter((r) => !areaId || r.area.id === areaId);
  const truncated = (data?.total ?? 0) > requests.length;

  return (
    <>
      <PageHeader
        title="Service"
        description="Demandes en cours, de la plus urgente à la plus récente."
        actions={
          viewer.can('requests.create') && (
            <Button onClick={() => setDialog({ kind: 'create' })}>
              <Plus className="size-4" aria-hidden />
              Nouvelle demande
            </Button>
          )
        }
      />

      <Tabs
        label="Filtrer les demandes"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'todo', label: 'À prendre', count: groups.todo.length },
          { value: 'mine', label: 'Les miennes', count: groups.mine.length },
          { value: 'all', label: 'Toutes', count: groups.all.length },
          { value: 'unpaid', label: 'À régler', count: groups.unpaid.length },
        ]}
      />

      {areas.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrer par zone">
          {[{ id: null as string | null, name: 'Toutes les zones' }, ...areas].map((area) => (
            <button
              key={area.id ?? 'all'}
              type="button"
              aria-pressed={areaId === area.id}
              onClick={() => setAreaId(area.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset transition-colors',
                areaId === area.id ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink-2 ring-line hover:text-ink',
              )}
            >
              {area.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {isPending ? (
          <Spinner />
        ) : isError ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<CheckCheck className="size-6" aria-hidden />}
            title={
              tab === 'unpaid' ? 'Tout est réglé' : tab === 'mine' ? 'Vous n’avez aucune demande en cours' : tab === 'todo' ? 'Rien à prendre pour l’instant' : 'Aucune demande en cours'
            }
            description={tab === 'todo' ? 'Les nouvelles demandes apparaissent ici dès qu’un client en fait une.' : undefined}
          />
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {visible.map((request) => (
              <li key={request.id}>
                <RequestCard
                  request={request}
                  now={now}
                  viewer={viewer}
                  busy={action.isPending && action.variables?.id === request.id}
                  onAction={(name) => action.mutate({ id: request.id, action: name })}
                  onDialog={setDialog}
                />
              </li>
            ))}
          </ul>
        )}
        {truncated && <p className="mt-3 text-center text-[13px] text-ink-3">Seules les 100 demandes les plus anciennes sont affichées.</p>}
      </div>

      <RequestDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
