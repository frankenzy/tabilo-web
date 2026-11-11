'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { AlertTriangle, MoreHorizontal, UserRound } from 'lucide-react';
import { Button } from '@/components/ui';
import { requestIcon, STATUS_LABELS } from '@/constants/requests';
import type { ServiceRequest } from '@/contracts';
import { cn } from '@/lib/utils';
import type { RequestAction } from '@/services/api';
import { formatClock, secondsSince } from '@/utils/time';
import { URGENCY_TILE, urgencyOf } from '@/utils/urgency';
import { capabilitiesOf, type Viewer } from './capabilities';
import { OrderLines } from './order-lines';
import type { RequestDialog } from './request-dialogs';

export { capabilitiesOf, type Viewer };

interface RequestCardProps {
  request: ServiceRequest;
  now: number;
  viewer: Viewer;
  busy: boolean;
  onAction: (action: RequestAction) => void;
  onDialog: (dialog: NonNullable<RequestDialog>) => void;
}

export function RequestCard({ request, now, viewer, busy, onAction, onDialog }: RequestCardProps) {
  const urgency = urgencyOf(request, now);
  const caps = capabilitiesOf(request, viewer);
  const Icon = requestIcon(request.type.icon);
  const escalated = request.escalationStatus === 'escalated';
  const mine = request.assignee?.id === viewer.id;
  const hasMenu = caps.assign || caps.transfer || caps.release || caps.cancel || caps.acknowledge;

  return (
    <article
      aria-label={`Table ${request.table.label}, ${request.type.label}, ${STATUS_LABELS[request.status]}`}
      className="flex gap-3 rounded-(--radius-card) bg-surface p-3 ring-1 ring-line"
    >
      <div
        className={cn(
          'flex w-[72px] shrink-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-center',
          URGENCY_TILE[urgency],
          escalated && 'animate-attention',
        )}
      >
        <span className="tabular max-w-full truncate font-mono text-2xl leading-none font-semibold">{request.table.label}</span>
        <span className="tabular mt-1.5 font-mono text-xs opacity-80" aria-label="Ancienneté">
          {formatClock(secondsSince(request.createdAt, now))}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">
                {request.type.label}
                {request.quantity !== null && <span className="tabular"> × {request.quantity}</span>}
              </span>
            </h3>
            <p className="mt-0.5 truncate text-[13px] text-ink-2">
              {request.area.name}
              {urgency === 'late' && <span className="font-medium text-late"> · En retard</span>}
              {request.priority === 'high' && <span className="font-medium text-brand-strong"> · Prioritaire</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDialog({ kind: 'detail', request })}
            className="-mt-1 shrink-0 rounded-lg px-2 py-1 text-[13px] text-ink-3 hover:bg-sunken hover:text-ink"
          >
            Détail
          </button>
        </div>

        {request.type.kind === 'order' && <OrderLines items={request.items} totalMinor={request.totalMinor} compact />}
        {request.note && <p className="mt-1.5 line-clamp-2 text-sm text-ink">« {request.note} »</p>}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
          {escalated && (
            <span className="inline-flex items-center gap-1 font-medium text-late">
              <AlertTriangle className="size-3.5" aria-hidden />
              Escaladée
            </span>
          )}
          {request.assignee ? (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" aria-hidden />
              {mine ? 'Vous' : request.assignee.firstName} · {STATUS_LABELS[request.status].toLowerCase()}
            </span>
          ) : (
            <span>Personne ne s’en occupe encore</span>
          )}
        </div>

        {(caps.primary || hasMenu) && (
          <div className="mt-3 flex items-center gap-2">
            {caps.primary && (
              <Button
                className="flex-1 sm:flex-none sm:min-w-36"
                variant={caps.primary.action === 'resolve' ? 'primary' : 'primary'}
                loading={busy}
                onClick={() => onAction(caps.primary!.action)}
              >
                {caps.primary.label}
              </Button>
            )}
            {hasMenu && (
              <Menu.Root>
                <Menu.Trigger asChild>
                  <Button variant="secondary" className={cn('px-3', !caps.primary && 'flex-1 sm:flex-none')} aria-label="Autres actions">
                    <MoreHorizontal className="size-4" aria-hidden />
                    {!caps.primary && 'Actions'}
                  </Button>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl bg-surface p-1 shadow-pop ring-1 ring-line animate-rise">
                    {caps.acknowledge && <Item onSelect={() => onAction('acknowledge-escalation')}>Acquitter l’escalade</Item>}
                    {caps.assign && (
                      <Item onSelect={() => onDialog({ kind: 'assign', request })}>{request.assignee ? 'Réaffecter…' : 'Affecter…'}</Item>
                    )}
                    {caps.transfer && <Item onSelect={() => onDialog({ kind: 'transfer', request })}>Transférer…</Item>}
                    {caps.release && <Item onSelect={() => onDialog({ kind: 'release', request })}>Remettre en attente…</Item>}
                    {caps.cancel && (
                      <Item danger onSelect={() => onDialog({ kind: 'cancel', request })}>
                        Annuler la demande…
                      </Item>
                    )}
                  </Menu.Content>
                </Menu.Portal>
              </Menu.Root>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Item({ children, onSelect, danger }: { children: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn(
        'cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-sunken',
        danger ? 'text-late' : 'text-ink',
      )}
    >
      {children}
    </Menu.Item>
  );
}
