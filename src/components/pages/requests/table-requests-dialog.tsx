'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Coffee, Pencil, Power, QrCode, Receipt, Smartphone, Timer, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { occupiedFor, orderStateLabel, orderSummary, tableLook, tableSize, TONE_BADGE, TONE_PLATE, TONE_TINT } from '@/components/pages/tables/tables-logic';
import type { OccupationOrder, ServiceRequest, TableStatus } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';
import { PrecisionBanner, PrecisionFlags } from './precisions';
import { floorApi, menuImageUrl } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';
import { formatMoney } from '@/utils/money';
import { formatClock, formatTime, secondsSince } from '@/utils/time';

interface Props {
  table: { id: string; label: string; seats: number };
  /** Zone de la table, rappelée sous le titre. */
  areaName?: string;
  /** Spec 006, R2 : occupée (session ouverte ou demande en cours) ou libre. */
  status: TableStatus;
  requests: ServiceRequest[];
  canClose: boolean;
  onClose: () => void;
  /** Rendu d'une demande (carte avec ses actions), fourni par la page appelante. */
  children: (request: ServiceRequest) => ReactNode;
  /** Spec 020, R6 : configuration de la table, en retrait (selon les droits ; absent = pas de bouton). */
  onQr?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Fiche d'une table (spec 020) : identité et état, chiffres clés, demandes en cours, commandes de l'occupation,
 * fermeture des sessions, puis configuration en retrait.
 * Partagée par le plan de salle du tableau de bord et la vue « Tables » (spec 006, R9 ; spec 020, R8).
 */
export function TableRequestsDialog({ table, areaName, status, requests, canClose, onClose, children, onQr, onEdit, onDelete }: Props) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const now = useNow();
  const occupation = useQuery({
    queryKey: estKey(establishmentId, 'table-occupation', table.id),
    queryFn: () => floorApi.occupation(establishmentId, table.id),
    refetchInterval: 15_000,
  });
  // Une demande qui arrive ou change d'état : les chiffres et les commandes suivent aussitôt (spec 006, R7).
  const signature = requests.map((request) => `${request.id}:${request.status}`).join(',');
  const refetch = occupation.refetch;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void refetch();
  }, [signature, refetch]);

  const close = useMutation({
    mutationFn: () => floorApi.closeSessions(establishmentId, table.id),
    onSuccess: ({ closed }) => {
      toast.success(closed > 0 ? `${closed} session${closed > 1 ? 's' : ''} fermée${closed > 1 ? 's' : ''}` : 'Aucune session ouverte');
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'floor') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
      void refetch();
    },
    onError: (error) => toast.error('Fermeture impossible', errorMessage(error)),
  });

  const data = occupation.data;
  const currency = data?.currency ?? 'XOF';
  const occupied = status === 'occupied' || (data?.occupiedSince ?? null) !== null;
  // Spec 023, R3 : une commande de l'occupation déjà servie.
  const look = tableLook(status, requests, now, (data?.orders ?? []).some((order) => order.status === 'resolved'));
  const tint = TONE_TINT[look.tone];
  const details = [areaName, tableSize(table.seats), `${table.seats} couvert${table.seats > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
  // Cascade d'entrée (R7) : chaque bloc arrive 40 ms après le précédent.
  let step = 0;
  const next = () => ({ '--i': step++ }) as CSSProperties;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] animate-slide-in-right flex-col bg-surface shadow-pop focus:outline-none"
        >
          {/* R1 : bandeau teinté de la couleur de l'état ; la teinte change en fondu. */}
          <header
            className="relative shrink-0 px-6 pt-6 pb-5 transition-[background] duration-700 ease-apple"
            style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${tint} 16%, var(--color-surface)), var(--color-surface))` }}
          >
            <DialogPrimitive.Close
              className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-surface/70 text-ink-2 ring-1 ring-line/70 backdrop-blur transition-transform duration-200 ease-apple hover:text-ink active:scale-90"
              aria-label="Fermer"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
            <div className="stagger flex animate-item-in items-center gap-4 pr-10" style={next()}>
              <div
                className={cn(
                  'grid size-16 shrink-0 place-items-center rounded-2xl font-mono text-xl font-semibold shadow-sm ring-1 ring-black/5 transition-colors duration-700',
                  TONE_PLATE[look.tone],
                )}
                aria-hidden
              >
                <span className="max-w-14 truncate">{table.label}</span>
              </div>
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="truncate text-[22px] leading-tight font-semibold tracking-tight text-ink">Table {table.label}</DialogPrimitive.Title>
                <p className="mt-1 truncate text-[13px] text-ink-2">{details}</p>
              </div>
            </div>
            <div className="stagger mt-4 flex animate-item-in items-center gap-2" style={next()}>
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold transition-colors duration-700',
                  TONE_BADGE[look.tone],
                  (look.tone === 'late' || look.escalated) && 'animate-attention',
                )}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {look.label}
                {look.oldestCreatedAt && <span className="tabular font-mono text-[12px] font-medium opacity-80">{formatClock(secondsSince(look.oldestCreatedAt, now))}</span>}
              </span>
              {look.escalated && <span className="text-[12px] font-medium text-late">Escaladée</span>}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-1 pb-6">
            {/* R2 : chiffres clés. */}
            <div className="stagger animate-item-in" style={next()}>
              {occupied ? (
                <dl className="grid grid-cols-[1.5fr_1fr_1fr] gap-2 sm:gap-2.5">
                  <Tile
                    icon={<Receipt className="size-4" aria-hidden />}
                    value={data?.amountMinor ?? null}
                    format={(value) => formatMoney(value, currency)}
                    label="commandés"
                    accent
                  />
                  <Tile
                    icon={<Timer className="size-4" aria-hidden />}
                    text={data?.occupiedSince ? occupiedFor(data.occupiedSince, now) : '—'}
                    label={data?.occupiedSince ? `depuis ${formatTime(data.occupiedSince)}` : 'occupée'}
                  />
                  <Tile
                    icon={<Smartphone className="size-4" aria-hidden />}
                    value={data ? data.openSessions : null}
                    format={(value) => String(value)}
                    label={`téléphone${(data?.openSessions ?? 0) > 1 ? 's' : ''} connecté${(data?.openSessions ?? 0) > 1 ? 's' : ''}`}
                  />
                </dl>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl bg-done-soft px-4 py-3.5 text-done">
                  <span className="grid size-10 place-items-center rounded-full bg-surface/70" aria-hidden>
                    <Coffee className="size-5" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold">Libre</p>
                    <p className="text-[12px] opacity-80">
                      {data?.lastOccupiedAt ? `Dernière occupation terminée à ${formatTime(data.lastOccupiedAt)}` : 'Prête à accueillir des clients'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* R3 : en cours. */}
            <section aria-labelledby="table-active-title" className="stagger mt-7 animate-item-in" style={next()}>
              <SectionTitle id="table-active-title" count={requests.length}>
                En cours
              </SectionTitle>
              {requests.length === 0 ? (
                <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-6 text-center">
                  <span className="grid size-11 place-items-center rounded-full bg-sunken text-ink-3" aria-hidden>
                    <Coffee className="size-5" />
                  </span>
                  <p className="text-[14px] font-medium text-ink">Tout est calme à cette table</p>
                  <p className="text-[12px] text-ink-3">Les demandes et commandes apparaîtront ici en direct.</p>
                </div>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {requests.map((request) => (
                    <li key={request.id} className="animate-item-in">
                      {children(request)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* R4 : commandes de l'occupation. */}
            {occupied && data && data.orders.length > 0 && (
              <section aria-labelledby="table-orders-title" className="stagger mt-7 animate-item-in" style={next()}>
                <div className="flex items-baseline justify-between gap-2">
                  <SectionTitle id="table-orders-title" count={data.orders.length}>
                    Commandes de la table
                  </SectionTitle>
                  {data.amountMinor !== null && <span className="tabular text-[15px] font-semibold text-brand">{formatMoney(data.amountMinor, currency)}</span>}
                </div>
                <ul className="mt-2 flex flex-col">
                  {data.orders.map((order) => (
                    <OrderRow key={order.id} order={order} currency={currency} />
                  ))}
                </ul>
              </section>
            )}

            {/* R5 : action de service. */}
            {canClose && occupied && (
              <div className="stagger mt-7 flex animate-item-in items-start gap-3 rounded-2xl bg-sunken/70 p-4" style={next()}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-sm" aria-hidden>
                  <Power className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">Les clients sont partis ?</p>
                  <p className="mt-0.5 text-[13px] text-ink-2">Fermez leurs sessions : leurs téléphones ne pourront plus envoyer de demande pour cette table.</p>
                  <Button variant="secondary" size="sm" className="mt-3" loading={close.isPending} onClick={() => close.mutate()}>
                    Fermer les sessions
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* R6 : configuration en retrait. */}
          {(onQr || onEdit || onDelete) && (
            <footer className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-6 py-3.5">
              {onQr && (
                <Button variant="secondary" size="sm" onClick={onQr}>
                  <QrCode className="size-4" aria-hidden />
                  QR code
                </Button>
              )}
              {onEdit && (
                <Button variant="secondary" size="sm" onClick={onEdit}>
                  <Pencil className="size-4" aria-hidden />
                  Modifier
                </Button>
              )}
              {onDelete && (
                <button type="button" onClick={onDelete} className="ml-auto rounded-lg px-2 py-1.5 text-[13px] font-medium text-late transition-colors hover:bg-late-soft">
                  Supprimer…
                </button>
              )}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SectionTitle({ id, count, children }: { id: string; count: number; children: ReactNode }) {
  return (
    <h3 id={id} className="flex items-center gap-2 text-[15px] font-semibold text-ink">
      {children}
      {count > 0 && (
        <span key={count} className="tabular grid h-5 min-w-5 animate-pop-in place-items-center rounded-full bg-ink px-1.5 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </h3>
  );
}

/** R2 : une tuile — pictogramme, chiffre en grand (compté à l'ouverture), libellé court. */
function Tile({
  icon, value, format, text, label, accent = false,
}: { icon: ReactNode; value?: number | null; format?: (value: number) => string; text?: string; label: string; accent?: boolean }) {
  const counted = useCountUp(value ?? null);
  const shown = text ?? (value === null || value === undefined || counted === null ? '—' : format ? format(counted) : String(counted));
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-2xl p-3 ring-1', accent ? 'bg-brand-soft/70 ring-brand/15' : 'bg-surface ring-line')}>
      <span className={cn('grid size-7 place-items-center rounded-full', accent ? 'bg-brand text-white' : 'bg-sunken text-ink-2')} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dd className={cn('tabular truncate text-[17px] leading-tight font-semibold tracking-tight sm:text-[19px]', accent ? 'text-brand-strong' : 'text-ink')}>{shown}</dd>
        <dt className="mt-0.5 line-clamp-2 text-[12px] leading-tight text-ink-3">{label}</dt>
      </div>
    </div>
  );
}

/** R2 : le chiffre monte jusqu'à sa valeur (environ 600 ms), puis suit les changements ; immédiat si moins d'animations. */
function useCountUp(target: number | null, duration = 600): number | null {
  const [value, setValue] = useState<number | null>(null);
  const from = useRef(0);
  useEffect(() => {
    if (target === null) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = from.current;
    if (reduce || start === target) {
      from.current = target;
      setValue(target);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (time: number) => {
      const progress = Math.min(1, (time - began) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (target - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target, duration]);
  return value;
}

/** R4 : une commande — vignettes, plats et articles, heure, état, montant ; le détail se déplie. */
function OrderRow({ order, currency }: { order: OccupationOrder; currency: string }) {
  const [open, setOpen] = useState(false);
  const { dishes, articles } = orderSummary(order.items);
  const state = orderStateLabel(order.status);
  const cancelled = state.tone === 'cancelled';
  const photos = order.items.slice(0, 2);
  return (
    <li className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn('flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition-colors hover:bg-sunken/50', cancelled && 'opacity-55')}
      >
        <span className="flex shrink-0 items-center" aria-hidden>
          {photos.map((item, index) => (
            <span key={item.menuItemId} className={cn('rounded-full ring-2 ring-surface', index > 0 && '-ml-3')} style={{ zIndex: 2 - index }}>
              <Thumb imageId={item.imageId} name={item.name} />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14px] font-medium text-ink">
            <span className="truncate">
              {dishes} plat{dishes > 1 ? 's' : ''} <span className="font-normal text-ink-3">· ×{articles}</span>
            </span>
            {/* Spec 022, R5 : la commande porte une précision. */}
            <PrecisionFlags notes={[order.note]} size="sm" />
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="tabular text-[12px] text-ink-3">{formatTime(order.createdAt)}</span>
            <StatePill state={state} />
          </span>
        </span>
        <span className={cn('tabular shrink-0 text-right text-[14px] font-semibold', cancelled ? 'text-ink-3 line-through' : 'text-ink')}>
          {formatMoney(order.totalMinor, currency)}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform duration-300 ease-apple', open && 'rotate-180')} aria-hidden />
      </button>
      <div inert={!open} className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-apple', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="min-h-0 overflow-hidden">
          <PrecisionBanner note={order.note} className="mb-2" />
          <ul className="mb-3 flex flex-col rounded-xl bg-sunken/60 px-3">
            {order.items.map((item) => (
              <li key={item.menuItemId} className="flex h-11 items-center gap-3 border-b border-line last:border-0">
                <Thumb imageId={item.imageId} name={item.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.name}</span>
                <span className="tabular shrink-0 text-[13px]">
                  <span className="font-semibold text-ink">{item.quantity}</span>
                  <span className="px-1 text-ink-3">×</span>
                  <span className="text-ink-2">{formatMoney(item.unitPriceMinor, currency)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

function StatePill({ state }: { state: ReturnType<typeof orderStateLabel> }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-px text-[11px] font-semibold',
        state.tone === 'done' && 'bg-done-soft text-done',
        state.tone === 'progress' && 'bg-progress-soft text-progress',
        state.tone === 'waiting' && 'bg-wait text-wait-ink',
        state.tone === 'cancelled' && 'bg-sunken text-ink-3',
      )}
    >
      {state.label}
    </span>
  );
}

function Thumb({ imageId, name, size = 'md' }: { imageId: string | null; name: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-7 rounded-lg' : 'size-9 rounded-full';
  if (imageId) {
    // eslint-disable-next-line @next/next/no-img-element -- photo servie par l'API, déjà réduite
    return <img src={menuImageUrl(imageId)} alt="" loading="lazy" className={cn('bg-sunken object-cover', box)} />;
  }
  return <span className={cn('grid place-items-center bg-sunken text-[11px] font-semibold text-ink-3', box)}>{name.charAt(0).toUpperCase()}</span>;
}
