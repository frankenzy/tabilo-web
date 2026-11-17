'use client';

import { Check, Clock, History, Receipt, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@/components/ui';
import type { GuestRequest, MenuCategory } from '@/contracts';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/money';
import { formatTime } from '@/utils/time';
import { haptic } from './fly-to-cart';
import { ItemPhoto } from './guest-menu';
import { inSpotlight, reorderLines, servedTotal, spotlightStart, unpaidTotal } from './order-logic';

/** Marge pour qu'une carte en train de sortir (R3) ne disparaisse pas d'un coup sur un rendu voisin. */
const EXIT_GRACE_MS = 1500;

interface SpotlightTrack {
  list: GuestRequest[] | null;
  status: ReadonlyMap<string, string>;
  start: ReadonlyMap<string, number>;
}

/**
 * Spec 018, R1 : les demandes servies gardent une minute « Bon appétit » dans le suivi.
 * Le début de la minute est fixé dès le rendu qui voit le service, pour que la carte ne quitte jamais la liste entre deux rendus.
 */
export function useServedSpotlight(requests: GuestRequest[], token: string) {
  const [track, setTrack] = useState<SpotlightTrack>({ list: null, status: new Map(), start: new Map() });
  // Fermées par le client : elles ne reviennent pas au rechargement (R2).
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => readDismissed(token));

  let current = track;
  // Une liste vide neuve à chaque rendu (données pas encore chargées) ne compte pas comme un changement.
  if (track.list !== requests && !(requests.length === 0 && track.list?.length === 0)) {
    const now = Date.now();
    const start = new Map(track.start);
    const status = new Map<string, string>();
    for (const request of requests) {
      if (!start.has(request.id)) {
        const at = spotlightStart(track.list ? track.status.get(request.id) : undefined, request, now);
        if (at !== null) start.set(request.id, at);
      }
      status.set(request.id, request.status);
    }
    current = { list: requests, status, start };
    setTrack(current);
  }

  const now = Date.now();
  const spotlight = new Map<string, number>();
  for (const request of requests) {
    const at = current.start.get(request.id);
    if (request.status === 'resolved' && at !== undefined && !dismissed.has(request.id) && inSpotlight(at - EXIT_GRACE_MS, now)) {
      spotlight.set(request.id, at);
    }
  }
  const dismiss = (id: string) =>
    setDismissed((set) => {
      const next = new Set(set).add(id);
      writeDismissed(token, next);
      return next;
    });
  return { spotlight, dismiss };
}

const dismissedKey = (token: string) => `tabilo.dismissed.${token}`;

function readDismissed(token: string): ReadonlySet<string> {
  try {
    const raw = window.sessionStorage.getItem(dismissedKey(token));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(token: string, ids: ReadonlySet<string>): void {
  try {
    // Les 50 dernières suffisent : l'API ne renvoie pas plus de demandes (R8).
    window.sessionStorage.setItem(dismissedKey(token), JSON.stringify([...ids].slice(-50)));
  } catch {
    /* stockage indisponible : la carte reviendrait au rechargement, sans autre effet */
  }
}

interface HistoryProps {
  /** Commandes terminées de ce téléphone (servies ou annulées), la plus récente d'abord. */
  orders: GuestRequest[];
  currency: string;
  menu: MenuCategory[];
  /** Demande « L'addition » de l'établissement (pictogramme `receipt`), s'il y en a une. */
  billAvailable: boolean;
  billPending: boolean;
  onBill: () => void;
  /** Relancer (R7) : `from` est la flèche touchée, point de départ de la vignette qui vole. */
  onReorder: (request: GuestRequest, from: DOMRect | null) => void;
}

/**
 * Spec 018, R5 : le bouton historique, à la place de la photo du serveur, et sa feuille « Ma note » (R6, R7).
 * Le conteneur (position au-dessus de la barre de commande) est fourni par la page.
 */
export function HistoryButton({ orders, currency, menu, billAvailable, billPending, onBill, onReorder }: HistoryProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic(6);
          setOpen(true);
        }}
        aria-label="Historique des commandes"
        className="pointer-events-auto relative grid size-16 animate-pop-in place-items-center rounded-full bg-ink text-white shadow-pop ring-4 ring-surface transition-transform duration-200 ease-apple active:scale-95"
      >
        <History className="size-7" strokeWidth={2} aria-hidden />
        <span
          key={orders.length}
          className="tabular absolute -top-1 -left-1 grid h-6 min-w-6 animate-pop-in place-items-center rounded-full bg-brand px-1.5 text-[12px] font-bold text-white ring-2 ring-surface"
          aria-hidden
        >
          {orders.length}
        </span>
      </button>

      {open && (
        <Dialog open onOpenChange={(next) => !next && setOpen(false)} title="Ma note">
          <HistorySheet
            orders={orders}
            currency={currency}
            menu={menu}
            billAvailable={billAvailable}
            billPending={billPending}
            onBill={() => {
              setOpen(false);
              onBill();
            }}
            onReorder={(request, from) => {
              setOpen(false);
              onReorder(request, from);
            }}
          />
        </Dialog>
      )}
    </>
  );
}

function HistorySheet({ orders, currency, menu, billAvailable, billPending, onBill, onReorder }: HistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const total = servedTotal(orders);
  const unpaid = unpaidTotal(orders);
  const hasServed = orders.some((request) => request.status === 'resolved');

  return (
    <div>
      <ul className="-mx-1 flex flex-col">
        {orders.map((request, index) => {
          const served = request.status === 'resolved';
          const open = expanded === request.id;
          const dishes = new Set(request.items.map((line) => line.menuItemId ?? line.name)).size;
          const quantity = request.items.reduce((sum, line) => sum + line.quantity, 0);
          const canReorder = reorderLines(request, menu).length > 0;
          const first = request.items[0];
          const photo = first?.menuItemId ? menu.flatMap((category) => category.items).find((item) => item.id === first.menuItemId) : undefined;
          return (
            <li key={request.id} className="animate-item-in border-b border-line last:border-0" style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : request.id)}
                  aria-expanded={open}
                  aria-label={`Commande ${served ? 'servie' : 'annulée'} à ${formatTime(request.createdAt)}, ${dishes} plat${dishes > 1 ? 's' : ''}, ${quantity} article${quantity > 1 ? 's' : ''}${request.totalMinor !== null ? `, ${formatMoney(request.totalMinor, currency)}` : ''}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-2.5 text-left transition-colors duration-200 active:bg-sunken"
                >
                  {/* 1. Photo du premier plat, coche (servie) ou croix (annulée). */}
                  <span className={cn('relative shrink-0', !served && 'opacity-55')}>
                    <ItemPhoto item={photo ?? { name: first?.name ?? '?', imageId: null }} className="size-12 rounded-xl text-sm" />
                    <span
                      className={cn('absolute -top-1 -left-1 grid size-5 place-items-center rounded-full text-white ring-2 ring-surface', served ? 'bg-done' : 'bg-ink-3')}
                      aria-hidden
                    >
                      {served ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                    </span>
                  </span>
                  {/* 2. Nombre de plats, l'heure dessous. */}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[15px] font-semibold', served ? 'text-ink' : 'text-ink-3')}>
                      {dishes} plat{dishes > 1 ? 's' : ''}
                    </span>
                    <span className="tabular flex items-center gap-1.5 text-[12px] text-ink-3">
                      {formatTime(served && request.resolvedAt ? request.resolvedAt : request.createdAt)}
                      {/* Spec 026, R8 : commande réglée. */}
                      {served && request.paidAt && <span className="rounded-full bg-done-soft px-1.5 py-px text-[11px] font-semibold text-done">Réglée</span>}
                    </span>
                  </span>
                  {/* 3. Quantité, 4. prix. */}
                  <span className="tabular shrink-0 text-[14px] text-ink-2">
                    <span className="text-ink-3">×</span>
                    {quantity}
                  </span>
                  {request.totalMinor !== null && (
                    <span className={cn('tabular w-[84px] shrink-0 text-right text-[15px] font-semibold tracking-tight', served ? 'text-ink' : 'text-ink-3 line-through')}>
                      {formatMoney(request.totalMinor, currency)}
                    </span>
                  )}
                </button>
                {/* 5. Relancer (R7). */}
                <button
                  type="button"
                  disabled={!canReorder}
                  onClick={(event) => {
                    haptic(10);
                    onReorder(request, event.currentTarget.getBoundingClientRect());
                  }}
                  aria-label="Relancer cette commande"
                  className="group grid size-11 shrink-0 place-items-center disabled:opacity-35"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand transition-[scale,background-color] duration-200 ease-apple group-active:scale-90 group-active:bg-brand group-active:text-white group-disabled:bg-sunken group-disabled:text-ink-3">
                    <RotateCcw className="size-[18px]" strokeWidth={2.5} aria-hidden />
                  </span>
                </button>
              </div>
              <div inert={!open} className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-apple', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                <div className="min-h-0 overflow-hidden">
                  <div className="px-1 pb-3">
                    <OrderDetail request={request} currency={currency} menu={menu} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {hasServed && (
        <div className="mt-4 rounded-2xl bg-sunken px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-ink-2">Total servi</span>
            <span className="tabular text-[26px] font-bold tracking-tight text-ink">{formatMoney(total, currency)}</span>
          </div>
          {/* Spec 026, R8 : ce qui reste à payer, seulement s'il y en a. */}
          {unpaid > 0 && (
            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-[13px] font-medium text-ink-2">Reste à régler</span>
              <span className="tabular text-[17px] font-semibold text-ink">{formatMoney(unpaid, currency)}</span>
            </div>
          )}
        </div>
      )}

      {billAvailable && (
        <button
          type="button"
          disabled={billPending}
          onClick={() => {
            haptic(10);
            onBill();
          }}
          className={cn(
            'mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-full text-[16px] font-semibold transition-[scale,background-color] duration-200 ease-apple',
            billPending ? 'bg-sunken text-ink-3' : 'bg-ink text-white shadow-pop active:scale-[0.97]',
          )}
        >
          {billPending ? <Clock className="size-5" aria-hidden /> : <Receipt className="size-5" aria-hidden />}
          {billPending ? 'Addition demandée' : 'L’addition'}
        </button>
      )}
    </div>
  );
}

/** Détail d'une commande de la note : vignette, nom, quantité × prix (format de la spec 016, sur fond clair). */
function OrderDetail({ request, currency, menu }: { request: GuestRequest; currency: string; menu: MenuCategory[] }) {
  const byId = new Map(menu.flatMap((category) => category.items).map((item) => [item.id, item]));
  return (
    <ul className="flex flex-col rounded-xl bg-sunken/60 px-3">
      {request.items.map((line) => {
        const item = line.menuItemId ? byId.get(line.menuItemId) : undefined;
        return (
          <li key={`${line.menuItemId ?? ''}-${line.name}`} className="flex h-12 items-center gap-3 border-b border-line last:border-0">
            <ItemPhoto item={item ?? { name: line.name, imageId: null }} className="size-9 shrink-0 rounded-[9px] text-xs" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{line.name}</span>
            <span className="tabular shrink-0 text-[13px] whitespace-nowrap">
              <span className="font-semibold text-ink">{line.quantity}</span>
              <span className="px-1 text-ink-3">×</span>
              <span className="text-ink-2">{formatMoney(line.unitPriceMinor, currency)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
