'use client';

import { ChevronRight, MessageCircle, Phone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SessionMarker } from '@/components/ui/session-marker';
import type { ServiceRequest } from '@/contracts';
import { markerInfo } from '@/contracts/session-markers';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';
import { useAuthStore, useMembership } from '@/stores/auth.store';
import { formatClock, secondsSince } from '@/utils/time';
import { RequestCard, type Viewer } from './request-card';
import { RequestDialogs, type RequestDialog } from './request-dialogs';
import { TableRequestsDialog } from './table-requests-dialog';
import { incomingCalls } from './table-bill';
import { useActiveRequests, useFloor, useRequestAction } from './use-requests';

/** Au-delà, une pastille « +N » : l'écran reste lisible. */
const MAX_SHOWN = 3;

/**
 * Spec 029, R6 : l'appel arrive en bas de l'écran, sur toutes les pages, comme un appel téléphonique.
 * Toucher une carte ouvre la fiche de la table.
 */
export function IncomingCalls() {
  const membership = useMembership();
  const canRead = membership?.permissions.includes('requests.read') ?? false;
  if (!canRead) return null;
  return <IncomingCallsInner />;
}

function IncomingCallsInner() {
  const active = useActiveRequests();
  const now = useNow();
  const [tableId, setTableId] = useState<string | null>(null);
  const incoming = useMemo(() => incomingCalls(active.data?.items ?? []), [active.data]);
  const shown = incoming.slice(-MAX_SHOWN);
  const hidden = incoming.length - shown.length;

  return (
    <>
      {!tableId && incoming.length > 0 && (
        <div
          aria-live="polite"
          className="no-print pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 mx-auto flex max-w-md flex-col gap-2 lg:right-8 lg:bottom-6 lg:left-auto lg:mx-0 lg:w-[380px]"
        >
          {hidden > 0 && (
            <span className="pointer-events-auto self-center rounded-full bg-ink/80 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur">+{hidden}</span>
          )}
          {shown.map((request) => (
            <CallToast key={request.id} request={request} now={now} onOpen={() => setTableId(request.table.id)} />
          ))}
        </div>
      )}
      {tableId && <TableSheetHost tableId={tableId} onClose={() => setTableId(null)} />}
    </>
  );
}

function CallToast({ request, now, onOpen }: { request: ServiceRequest; now: number; onOpen: () => void }) {
  const call = request.type.kind === 'call';
  const marker = request.marker ?? null;
  const name = marker === null ? null : markerInfo(marker).name;
  const waited = formatClock(secondsSince(request.createdAt, now));
  const where = [name, request.area?.name].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={call ? `Table ${request.table.label} appelle. Ouvrir la table` : `Message de la table ${request.table.label} : ${request.note ?? ''}. Ouvrir la table`}
      className={cn(
        'pointer-events-auto flex w-full animate-toast-in items-center gap-3 text-left transition-transform duration-300 ease-spring active:scale-[0.98]',
        call
          ? 'rounded-[28px] bg-ink py-3 pr-4 pl-3 text-white shadow-[0_22px_44px_-16px_rgb(27_25_23/0.8)]'
          : 'rounded-3xl bg-surface py-2.5 pr-4 pl-2.5 text-ink shadow-[0_16px_36px_-14px_rgb(0_0_0/0.35)] ring-1 ring-line',
      )}
    >
      <span className={cn('relative grid shrink-0 place-items-center', call ? 'size-14' : 'size-12')} aria-hidden>
        {call && (
          <>
            <span className="absolute inset-0 rounded-full bg-call motion-safe:animate-call-wave" />
            <span className="absolute inset-0 rounded-full bg-call [animation-delay:550ms] motion-safe:animate-call-wave" />
          </>
        )}
        <span className={cn('relative grid size-full place-items-center rounded-full', call ? 'bg-call text-ink' : 'bg-message text-white')}>
          {call ? <Phone className="size-6 motion-safe:animate-call-ring" /> : <MessageCircle className="size-[22px]" />}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        {call ? (
          <>
            <span className="block truncate text-[18px] leading-tight font-semibold tracking-tight">Table {request.table.label} appelle</span>
            <span className="mt-1 flex items-center gap-1.5 text-[13px] text-white/70">
              {marker !== null && <SessionMarker index={marker} size="xs" decorative />}
              <span className="truncate capitalize">{where}</span>
              <span className="tabular shrink-0 font-mono">· {waited}</span>
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-[14px] font-semibold">
              Table {request.table.label}
              {marker !== null && <SessionMarker index={marker} size="xs" decorative />}
              <span className="tabular font-mono font-medium text-ink-3">{waited}</span>
            </span>
            <span className="mt-0.5 block truncate text-[14px] text-ink-2">« {request.note} »</span>
          </>
        )}
      </span>
      <ChevronRight className={cn('size-5 shrink-0', call ? 'text-white/60' : 'text-ink-3')} aria-hidden />
    </button>
  );
}

/** La fiche d'une table, ouverte depuis n'importe quelle page (spec 029, R6). */
function TableSheetHost({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const me = useAuthStore((state) => state.me);
  const membership = useMembership();
  const active = useActiveRequests();
  const floor = useFloor();
  const action = useRequestAction();
  const now = useNow();
  const [dialog, setDialog] = useState<RequestDialog>(null);
  const viewer: Viewer = useMemo(
    () => ({ id: me?.id ?? '', can: (permission) => membership?.permissions.includes(permission) ?? false }),
    [me, membership],
  );
  const area = floor.data?.find((candidate) => candidate.tables.some((table) => table.id === tableId));
  const table = area?.tables.find((candidate) => candidate.id === tableId);
  if (!table) return null;
  const requests = (active.data?.items ?? []).filter((request) => request.table.id === tableId);
  return (
    <>
      <TableRequestsDialog
        table={table}
        areaName={area?.name}
        status={table.openSessions > 0 || requests.length > 0 ? 'occupied' : 'free'}
        requests={requests}
        canClose={viewer.can('sessions.manage')}
        canSettle={viewer.can('requests.handle')}
        onClose={onClose}
      >
        {(request) => (
          <RequestCard
            request={request}
            now={now}
            viewer={viewer}
            busy={action.isPending && action.variables?.id === request.id}
            onAction={(name) => action.mutate({ id: request.id, action: name })}
            onDialog={setDialog}
          />
        )}
      </TableRequestsDialog>
      <RequestDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
