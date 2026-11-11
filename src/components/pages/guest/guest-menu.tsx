'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageOff, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Dialog, FormError, Textarea } from '@/components/ui';
import type { GuestContext, GuestRequest, MenuItem, OrderLine } from '@/contracts';
import { cn } from '@/lib/utils';
import { menuImageUrl } from '@/services/api';
import { guestApi } from '@/services/api/guest';
import { errorMessage, toHttpError } from '@/services/http';
import { formatMoney } from '@/utils/money';
import { cartLines, MAX_QUANTITY, type Cart } from './cart';
import { guestRequestsKey, upsert } from './use-guest-requests';

/** Carte et panier du client à table (spec 001, P2). */

const NOTE_MAX = 280;

interface MenuViewProps {
  context: GuestContext;
  cart: Cart;
  onQuantity: (itemId: string, quantity: number) => void;
}

export function MenuView({ context, cart, onQuantity }: MenuViewProps) {
  const currency = context.establishment.currency;
  return (
    <div className="flex flex-col gap-8">
      {!context.orderingEnabled && (
        <p role="status" className="rounded-lg bg-sunken px-3 py-2 text-[13px] text-ink-2">
          La commande en ligne est suspendue. Vous pouvez consulter la carte et commander auprès du personnel.
        </p>
      )}
      {context.menu.map((category) => (
        <section key={category.id} aria-labelledby={`cat-${category.id}`}>
          <h2 id={`cat-${category.id}`} className="text-[15px] font-semibold text-ink">
            {category.name}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {category.items.map((item) => (
              <MenuRow
                key={item.id}
                item={item}
                currency={currency}
                quantity={cart[item.id] ?? 0}
                orderable={context.orderingEnabled}
                onQuantity={(quantity) => onQuantity(item.id, quantity)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MenuRow({ item, currency, quantity, orderable, onQuantity }: { item: MenuItem; currency: string; quantity: number; orderable: boolean; onQuantity: (q: number) => void }) {
  return (
    <li className="flex gap-3 py-3">
      {item.imageId ? (
        // eslint-disable-next-line @next/next/no-img-element -- photo servie par l'API, déjà réduite
        <img src={menuImageUrl(item.imageId)} alt="" loading="lazy" className={cn('size-20 shrink-0 rounded-xl object-cover', !item.isAvailable && 'opacity-50 grayscale')} />
      ) : (
        <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-sunken text-ink-3" aria-hidden>
          <ImageOff className="size-5" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className={cn('text-[15px] leading-tight font-medium', item.isAvailable ? 'text-ink' : 'text-ink-3')}>{item.name}</p>
        {item.description && <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{item.description}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className={cn('tabular text-sm font-semibold', item.isAvailable ? 'text-ink' : 'text-ink-3')}>{formatMoney(item.priceMinor, currency)}</span>
          {!item.isAvailable ? (
            <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-ink-3">Épuisé</span>
          ) : orderable ? (
            quantity === 0 ? (
              <Button size="sm" variant="secondary" onClick={() => onQuantity(1)} aria-label={`Ajouter ${item.name}`}>
                <Plus className="size-4" aria-hidden />
                Ajouter
              </Button>
            ) : (
              <Stepper name={item.name} quantity={quantity} onChange={onQuantity} />
            )
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Stepper({ name, quantity, onChange }: { name: string; quantity: number; onChange: (q: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-ink text-white">
      <button type="button" className="grid size-9 place-items-center" onClick={() => onChange(quantity - 1)} aria-label={`Retirer un ${name}`}>
        {quantity === 1 ? <Trash2 className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
      </button>
      <span className="tabular min-w-5 text-center text-sm font-semibold" aria-live="polite" aria-label={`${quantity} ${name}`}>
        {quantity}
      </span>
      <button type="button" className="grid size-9 place-items-center disabled:opacity-40" disabled={quantity >= MAX_QUANTITY} onClick={() => onChange(quantity + 1)} aria-label={`Ajouter un ${name}`}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Barre fixe en bas d'écran : accès au panier. */
export function CartBar({ count, totalMinor, currency, onOpen }: { count: number; totalMinor: number; currency: string; onOpen: () => void }) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-4">
      <button
        type="button"
        onClick={onOpen}
        className="pointer-events-auto mx-auto flex h-14 w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-5 text-white shadow-pop"
      >
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <ShoppingBag className="size-5" aria-hidden />
          Voir le panier
        </span>
        <span className="tabular text-sm">
          {count} article{count > 1 ? 's' : ''} · {formatMoney(totalMinor, currency)}
        </span>
      </button>
    </div>
  );
}

const ORDER_ERRORS = new Set(['MENU_ITEM_UNAVAILABLE', 'MENU_ITEM_NOT_FOUND', 'ORDERING_DISABLED']);

interface CartSheetProps {
  token: string;
  context: GuestContext;
  cart: Cart;
  onQuantity: (itemId: string, quantity: number) => void;
  onClose: () => void;
  onOrdered: () => void;
  onContextStale: () => void;
  onSessionClosed: () => void;
}

export function CartSheet({ token, context, cart, onQuantity, onClose, onOrdered, onContextStale, onSessionClosed }: CartSheetProps) {
  const queryClient = useQueryClient();
  const currency = context.establishment.currency;
  const { lines, count, totalMinor, hasInvalid } = cartLines(cart, context.menu);
  const [note, setNote] = useState('');
  // Une clé par intention de commander : un double appui ou une reprise réseau ne crée qu'une commande.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const send = useMutation({
    mutationFn: () =>
      guestApi.order(
        token,
        { items: lines.filter((line) => !line.invalid).map((line) => ({ menuItemId: line.itemId, quantity: line.quantity })), note: note.trim() || undefined },
        idempotencyKey,
      ),
    onSuccess: ({ request }) => {
      queryClient.setQueryData<GuestRequest[]>(guestRequestsKey(token), (list = []) => upsert(list, request));
      onOrdered();
    },
    onError: (error) => {
      const http = toHttpError(error);
      if (http.status === 401 || http.code === 'TABLE_SESSION_CLOSED') return onSessionClosed();
      // La carte a changé (rupture, retrait, commande suspendue) : on la relit pour signaler les lignes concernées.
      if (ORDER_ERRORS.has(http.code)) onContextStale();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !send.isPending && onClose()} title="Votre commande" description={`Table ${context.table.label}`}>
      <div className="flex flex-col gap-4">
        {lines.length === 0 ? (
          <p className="text-sm text-ink-2">Votre panier est vide.</p>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((line) => (
              <li key={line.itemId} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium', line.invalid ? 'text-ink-3 line-through' : 'text-ink')}>{line.item?.name ?? 'Article retiré de la carte'}</p>
                  {line.invalid ? (
                    <p className="text-[13px] text-late">N’est plus disponible</p>
                  ) : (
                    <p className="tabular text-[13px] text-ink-2">{formatMoney(line.quantity * (line.item?.priceMinor ?? 0), currency)}</p>
                  )}
                </div>
                {line.invalid ? (
                  <Button variant="ghost" size="sm" onClick={() => onQuantity(line.itemId, 0)}>
                    Retirer
                  </Button>
                ) : (
                  <Stepper name={line.item?.name ?? ''} quantity={line.quantity} onChange={(quantity) => onQuantity(line.itemId, quantity)} />
                )}
              </li>
            ))}
          </ul>
        )}
        <Textarea
          label="Une précision ? (facultatif)"
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder="Ex. : sans piment, bien frais"
        />
        <p className="flex items-baseline justify-between text-[15px]">
          <span className="text-ink-2">Total</span>
          <span className="tabular text-lg font-semibold text-ink">{formatMoney(totalMinor, currency)}</span>
        </p>
        {hasInvalid && !send.isError && <FormError message="Retirez les articles qui ne sont plus disponibles pour envoyer la commande." />}
        <FormError message={send.isError ? errorMessage(send.error) : null} />
        <Button size="lg" className="h-14 text-base" loading={send.isPending} disabled={count === 0 || hasInvalid || !context.orderingEnabled} onClick={() => send.mutate()}>
          Envoyer la commande
        </Button>
        <p className="text-center text-xs text-ink-3">Le règlement se fait auprès du personnel.</p>
      </div>
    </Dialog>
  );
}

/** Contenu d'une commande dans le suivi du client (CA-001-26). */
export function GuestOrderLines({ items, totalMinor, currency }: { items: OrderLine[]; totalMinor: number | null; currency: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm">
      <ul className="flex flex-col gap-0.5">
        {items.map((line) => (
          <li key={line.name}>
            <span className="tabular font-semibold">{line.quantity} ×</span> {line.name}
          </li>
        ))}
      </ul>
      {totalMinor !== null && (
        <p className="mt-1 flex justify-between border-t border-white/15 pt-1 text-[13px] text-white/80">
          <span>Total</span>
          <span className="tabular font-semibold text-white">{formatMoney(totalMinor, currency)}</span>
        </p>
      )}
    </div>
  );
}
