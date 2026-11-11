'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Minus, PauseCircle, Plus, RefreshCw, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, FormError, Textarea } from '@/components/ui';
import type { GuestContext, GuestRequest, MenuItem, OrderLine } from '@/contracts';
import { CategoryImage } from '@/components/pages/menu/category-image';
import { cn } from '@/lib/utils';
import { menuImageUrl } from '@/services/api';
import { guestApi } from '@/services/api/guest';
import { errorMessage, toHttpError } from '@/services/http';
import { formatMoney } from '@/utils/money';
import { cartLines, MAX_QUANTITY, type Cart } from './cart';
import { guestRequestsKey, upsert } from './use-guest-requests';

/**
 * Carte et commande du client à table (spec 002) : on choisit par l'image, on vérifie sa commande
 * sur un écran plein écran, avec des suggestions et un bouton « Commander » toujours visible.
 */

const NOTE_MAX = 280;

// ------------------------------------------------------------------ photos

/** Photo d'article, ou aplat avec l'initiale : la grille garde toujours la même géométrie (CA-002-03). */
function ItemPhoto({ item, className, dimmed }: { item: Pick<MenuItem, 'name' | 'imageId'>; className?: string; dimmed?: boolean }) {
  if (item.imageId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photo servie par l'API, déjà réduite
      <img
        src={menuImageUrl(item.imageId)}
        alt={item.name}
        loading="lazy"
        className={cn('bg-sunken object-cover', dimmed && 'opacity-45 grayscale', className)}
      />
    );
  }
  return (
    <span aria-hidden className={cn('grid place-items-center bg-sunken font-semibold text-ink-3 select-none', dimmed && 'opacity-60', className)}>
      <span className="text-[2em] leading-none">{item.name.trim().charAt(0).toUpperCase()}</span>
    </span>
  );
}

/** Pastille « − n + » de la référence. */
function Stepper({ name, quantity, onChange, size = 'md' }: { name: string; quantity: number; onChange: (q: number) => void; size?: 'md' | 'lg' }) {
  const button = size === 'lg' ? 'size-11' : 'size-9';
  return (
    <div className="inline-flex items-center rounded-full bg-sunken text-ink">
      <button type="button" className={cn('grid place-items-center rounded-full', button)} onClick={() => onChange(quantity - 1)} aria-label={`Retirer un ${name}`}>
        {quantity === 1 && size === 'md' ? <Trash2 className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
      </button>
      <span className="tabular min-w-6 text-center text-[15px] font-semibold" aria-live="polite" aria-label={`${quantity} ${name}`}>
        {quantity}
      </span>
      <button
        type="button"
        className={cn('grid place-items-center rounded-full disabled:opacity-35', button)}
        disabled={quantity >= MAX_QUANTITY}
        onClick={() => onChange(quantity + 1)}
        aria-label={`Ajouter un ${name}`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

// -------------------------------------------------------------------- carte

interface MenuViewProps {
  context: GuestContext;
  cart: Cart;
  onQuantity: (itemId: string, quantity: number) => void;
}

export function MenuView({ context, cart, onQuantity }: MenuViewProps) {
  const currency = context.establishment.currency;
  const [active, setActive] = useState(context.menu[0]?.id);
  const [opened, setOpened] = useState<MenuItem | null>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const chips = useRef(new Map<string, HTMLButtonElement>());

  // Rubrique en cours = la première, dans l'ordre de la carte, qui occupe le haut de l'écran (CA-002-01).
  // L'observateur ne signale que les changements : on garde l'ensemble des rubriques visibles.
  useEffect(() => {
    const visible = new Set<string>();
    const order = context.menu.map((category) => category.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id.replace('cat-', '');
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = order.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: '-64px 0px -55% 0px' },
    );
    sections.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [context.menu]);

  useEffect(() => {
    if (active) chips.current.get(active)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  return (
    <>
      <nav aria-label="Rubriques de la carte" className="sticky top-0 z-20 -mx-4 bg-paper/95 px-4 pt-2 pb-2 backdrop-blur">
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pt-1.5 pb-1 [scrollbar-width:none]">
          {context.menu.map((category) => (
            <button
              key={category.id}
              ref={(element) => {
                if (element) chips.current.set(category.id, element);
              }}
              type="button"
              aria-current={active === category.id ? 'true' : undefined}
              onClick={() => {
                setActive(category.id);
                sections.current.get(category.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              aria-label={category.name}
              className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
            >
              {/* Image d'abord : beaucoup de clients ne lisent pas (spec 003). */}
              <CategoryImage
                icon={category.icon}
                imageId={category.imageId}
                name=""
                className={cn(
                  'size-16 rounded-2xl transition-shadow',
                  active === category.id ? 'ring-[3px] ring-ink ring-offset-2 ring-offset-paper' : 'ring-1 ring-line',
                  !category.imageId && 'bg-surface',
                )}
                iconClassName="size-8"
              />
              <span className={cn('w-full truncate text-center text-xs', active === category.id ? 'font-semibold text-ink' : 'text-ink-2')}>{category.name}</span>
            </button>
          ))}
        </div>
      </nav>

      {!context.orderingEnabled && (
        <p role="status" className="mt-3 flex items-start gap-2.5 rounded-xl bg-sunken px-3 py-2.5 text-[13px] text-ink-2">
          <PauseCircle className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
          La commande en ligne est suspendue. Vous pouvez consulter la carte et commander auprès du personnel.
        </p>
      )}

      <div className="mt-2 flex flex-col gap-8">
        {context.menu.map((category) => (
          <section
            key={category.id}
            id={`cat-${category.id}`}
            ref={(element) => {
              if (element) sections.current.set(category.id, element);
            }}
            aria-labelledby={`title-${category.id}`}
            className="scroll-mt-16"
          >
            <h2 id={`title-${category.id}`} className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-ink">
              <CategoryImage icon={category.icon} imageId={category.imageId} name="" className="size-9 rounded-xl bg-surface ring-1 ring-line" iconClassName="size-5" />
              {category.name}
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5">
              {category.items.map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  currency={currency}
                  quantity={cart[item.id] ?? 0}
                  orderable={context.orderingEnabled}
                  onAdd={() => onQuantity(item.id, 1)}
                  onOpen={() => setOpened(item)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {opened && (
        <ItemSheet
          item={opened}
          currency={currency}
          orderable={context.orderingEnabled}
          inCart={cart[opened.id] ?? 0}
          onSave={(quantity) => {
            onQuantity(opened.id, quantity);
            setOpened(null);
          }}
          onClose={() => setOpened(null)}
        />
      )}
    </>
  );
}

interface MenuCardProps {
  item: MenuItem;
  currency: string;
  quantity: number;
  orderable: boolean;
  onAdd: () => void;
  onOpen: () => void;
}

function MenuCard({ item, currency, quantity, orderable, onAdd, onOpen }: MenuCardProps) {
  const canAdd = orderable && item.isAvailable;
  const price = formatMoney(item.priceMinor, currency);
  return (
    <li>
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full" aria-label={`${item.name}, ${price}${item.isAvailable ? '' : ', épuisé'}`}>
          <ItemPhoto item={item} dimmed={!item.isAvailable} className="aspect-square w-full rounded-2xl text-2xl" />
          {!item.isAvailable && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-1 text-xs font-medium text-late shadow-sm">
              <Ban className="size-3.5" aria-hidden />
              Épuisé
            </span>
          )}
        </button>
        {canAdd && (
          <button
            type="button"
            onClick={quantity === 0 ? onAdd : onOpen}
            aria-label={quantity === 0 ? `Ajouter ${item.name}` : `${quantity} ${item.name} dans la commande, modifier`}
            className="tabular absolute right-2 bottom-2 grid size-10 place-items-center rounded-full bg-ink text-[15px] font-semibold text-white shadow-pop ring-2 ring-surface active:scale-95"
          >
            {quantity === 0 ? <Plus className="size-5" aria-hidden /> : quantity}
          </button>
        )}
      </div>
      {/* Le nom et le prix ouvrent aussi la fiche ; le bouton de la photo porte déjà le libellé accessible. */}
      <button type="button" onClick={onOpen} tabIndex={-1} aria-hidden className="mt-2 block w-full text-left">
        <span className={cn('line-clamp-2 block text-[15px] leading-snug font-medium', item.isAvailable ? 'text-ink' : 'text-ink-3')}>{item.name}</span>
        <span className={cn('tabular mt-0.5 block text-sm', item.isAvailable ? 'text-ink-2' : 'text-ink-3')}>{price}</span>
      </button>
    </li>
  );
}

/** Fiche d'un article (CA-002-04). */
function ItemSheet({ item, currency, orderable, inCart, onSave, onClose }: { item: MenuItem; currency: string; orderable: boolean; inCart: number; onSave: (quantity: number) => void; onClose: () => void }) {
  const [quantity, setQuantity] = useState(Math.max(1, inCart));
  const canOrder = orderable && item.isAvailable;
  const label = inCart === 0 ? 'Ajouter' : quantity === 0 ? 'Retirer' : 'Mettre à jour';
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={item.name}>
      <div className="flex flex-col gap-4">
        <ItemPhoto item={item} dimmed={!item.isAvailable} className="-mx-5 -mt-1 aspect-[4/3] w-[calc(100%+2.5rem)] text-4xl" />
        <div>
          <p className="tabular text-lg font-semibold text-ink">{formatMoney(item.priceMinor, currency)}</p>
          {item.description && <p className="mt-1 text-sm text-ink-2">{item.description}</p>}
          {!item.isAvailable && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-late">
              <Ban className="size-4" aria-hidden />
              Épuisé pour le moment
            </p>
          )}
        </div>
        {canOrder && (
          <div className="flex items-center gap-3">
            <Stepper name={item.name} quantity={quantity} size="lg" onChange={(q) => setQuantity(Math.max(inCart > 0 ? 0 : 1, q))} />
            <Button size="lg" className="h-12 flex-1 rounded-full" variant={label === 'Retirer' ? 'secondary' : 'primary'} onClick={() => onSave(quantity)}>
              {label === 'Retirer' ? <Trash2 className="size-5" aria-hidden /> : label === 'Ajouter' ? <Plus className="size-5" aria-hidden /> : <RefreshCw className="size-5" aria-hidden />}
              {label}
              {quantity > 0 && <span className="tabular font-normal opacity-80">· {formatMoney(quantity * item.priceMinor, currency)}</span>}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------- barre de commande

/** Barre flottante « Voir la commande » (CA-002-06). */
export function CartBar({ count, totalMinor, currency, onOpen }: { count: number; totalMinor: number; currency: string; onOpen: () => void }) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onOpen}
        className="pointer-events-auto mx-auto flex h-14 w-full max-w-md items-center justify-between gap-3 rounded-full bg-ink pr-5 pl-2 text-white shadow-pop active:scale-[0.99]"
      >
        <span className="flex items-center gap-3 text-[15px] font-semibold">
          <span className="relative grid size-10 place-items-center rounded-full bg-white/15">
            <ShoppingBag className="size-5" aria-hidden />
            <span className="tabular absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{count}</span>
          </span>
          Voir la commande
        </span>
        <span className="tabular text-[15px] font-semibold">{formatMoney(totalMinor, currency)}</span>
      </button>
    </div>
  );
}

// ------------------------------------------------ écran « Votre commande »

const ORDER_ERRORS = new Set(['MENU_ITEM_UNAVAILABLE', 'MENU_ITEM_NOT_FOUND', 'ORDERING_DISABLED']);

interface OrderScreenProps {
  token: string;
  context: GuestContext;
  cart: Cart;
  onQuantity: (itemId: string, quantity: number) => void;
  onClose: () => void;
  onOrdered: () => void;
  onContextStale: () => void;
  onSessionClosed: () => void;
}

/** Écran plein écran « Votre commande » (CA-002-07, 08, 09, 12). */
export function OrderScreen({ token, context, cart, onQuantity, onClose, onOrdered, onContextStale, onSessionClosed }: OrderScreenProps) {
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
    <DialogPrimitive.Root open onOpenChange={(open) => !open && !send.isPending && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col bg-surface animate-rise focus:outline-none" aria-describedby={undefined}>
          <header className="relative flex h-14 shrink-0 items-center justify-center border-b border-line px-14">
            <DialogPrimitive.Close className="absolute left-2 grid size-11 place-items-center rounded-full text-ink hover:bg-sunken" aria-label="Fermer">
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
            <DialogPrimitive.Title className="text-base font-semibold text-ink">Votre commande</DialogPrimitive.Title>
          </header>

          <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto">
            <section aria-label="Articles de la commande" className="px-4 pt-2">
              {lines.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-2">Votre commande est vide.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {lines.map((line) => (
                    <li key={line.itemId} className="flex items-center gap-3 py-3">
                      <ItemPhoto item={line.item ?? { name: '?', imageId: null }} dimmed={line.invalid} className="size-14 shrink-0 rounded-xl text-base" />
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-[15px] font-medium', line.invalid ? 'text-ink-3 line-through' : 'text-ink')}>{line.item?.name ?? 'Article retiré'}</p>
                        {line.invalid ? (
                          <p className="flex items-center gap-1 text-[13px] text-late">
                            <Ban className="size-3.5" aria-hidden />
                            N’est plus disponible
                          </p>
                        ) : (
                          <p className="tabular text-[13px] text-ink-2">{formatMoney(line.item?.priceMinor ?? 0, currency)}</p>
                        )}
                      </div>
                      {line.invalid ? (
                        <Button variant="ghost" size="sm" onClick={() => onQuantity(line.itemId, 0)}>
                          <Trash2 className="size-4" aria-hidden />
                          Retirer
                        </Button>
                      ) : (
                        <Stepper name={line.item?.name ?? ''} quantity={line.quantity} onChange={(quantity) => onQuantity(line.itemId, quantity)} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end pb-4">
                <button type="button" onClick={onClose} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-sunken px-4 text-[13px] font-medium text-ink hover:bg-line">
                  <Plus className="size-4" aria-hidden />
                  Ajouter d’autres articles
                </button>
              </div>
            </section>

            <Suggestions token={token} context={context} cart={cart} onAdd={(id) => onQuantity(id, 1)} />

            <section className="px-4 pt-5 pb-6">
              <Textarea
                label="Une précision ? (facultatif)"
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
                maxLength={NOTE_MAX}
                rows={2}
                placeholder="Ex. : sans piment, bien frais"
              />
            </section>
          </div>

          <footer className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex w-full max-w-md flex-col gap-3">
              {hasInvalid && !send.isError && <FormError message="Retirez les articles qui ne sont plus disponibles pour commander." />}
              <FormError message={send.isError ? errorMessage(send.error) : null} />
              <p className="flex items-baseline justify-between">
                <span className="text-[15px] font-medium text-ink">Total de la commande</span>
                <span className="tabular text-lg font-semibold text-ink">{formatMoney(totalMinor, currency)}</span>
              </p>
              <Button size="lg" className="h-14 rounded-full text-base" loading={send.isPending} disabled={count === 0 || hasInvalid || !context.orderingEnabled} onClick={() => send.mutate()}>
                {!send.isPending && <Check className="size-5" strokeWidth={2.5} aria-hidden />}
                Commander
              </Button>
              <p className="text-center text-xs text-ink-3">Le règlement se fait auprès du personnel.</p>
            </div>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Rangée « Souvent commandés avec » (CA-002-09, 10). Un échec masque simplement la rangée. */
function Suggestions({ token, context, cart, onAdd }: { token: string; context: GuestContext; cart: Cart; onAdd: (itemId: string) => void }) {
  const ids = Object.keys(cart).sort();
  const { data } = useQuery({
    queryKey: ['guest', token, 'suggestions', ids],
    queryFn: () => guestApi.suggestions(token, ids),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: context.orderingEnabled,
  });
  const items = new Map(context.menu.flatMap((category) => category.items).map((item) => [item.id, item]));
  const suggested = (data ?? []).map((id) => items.get(id)).filter((item): item is MenuItem => !!item && item.isAvailable && !cart[item.id]);
  if (suggested.length === 0) return null;
  return (
    <section aria-labelledby="suggestions-title" className="border-t-8 border-paper pt-5">
      <h2 id="suggestions-title" className="flex items-center gap-2 px-4 text-[17px] font-semibold tracking-tight text-ink">
        <Sparkles className="size-5 text-brand" aria-hidden />
        Souvent commandés avec
      </h2>
      <ul className="mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {suggested.map((item) => (
          <li key={item.id} className="relative w-36 shrink-0 snap-start">
            <ItemPhoto item={item} className="aspect-square w-full rounded-2xl text-2xl" />
            <button
              type="button"
              onClick={() => onAdd(item.id)}
              aria-label={`Ajouter ${item.name}`}
              className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-ink text-white shadow-pop active:scale-95"
            >
              <Plus className="size-4" aria-hidden />
            </button>
            <p className="mt-2 line-clamp-2 text-sm leading-snug font-medium text-ink">{item.name}</p>
            <p className="tabular text-[13px] text-ink-2">{formatMoney(item.priceMinor, context.establishment.currency)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ suivi

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
