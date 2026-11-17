'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, ChevronDown, ChevronLeft, ChevronRight, Minus, PauseCircle, Plus, Search, SearchX, ShoppingBag, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, FormError, Textarea } from '@/components/ui';
import type { GuestContext, GuestRequest, MenuCategory, MenuItem, OrderLine } from '@/contracts';
import { CategoryImage } from '@/components/pages/menu/category-image';
import { cn, randomId } from '@/lib/utils';
import { menuImageUrl } from '@/services/api';
import { guestApi } from '@/services/api/guest';
import { errorMessage, toHttpError } from '@/services/http';
import { formatMoney } from '@/utils/money';
import { cartLines, MAX_QUANTITY, type Cart, type OrderDetails } from './cart';
import { CART_BUMP, CART_TARGET_ATTR, flyToCart, haptic } from './fly-to-cart';
import { CancelOrderButton, composeNote, OrderTracker, PrecisionChips, SlideToConfirm, SuccessCheck, TableBadge } from './order-flow';
import { prefersReducedMotion, usePhotoTint } from './photo-tint';
import { guestRequestsKey, upsert } from './use-guest-requests';

/**
 * Carte et commande du client à table (spec 002) : on choisit par l'image, on vérifie sa commande
 * sur un écran plein écran, avec des suggestions et un bouton « Commander » toujours visible.
 */

const NOTE_MAX = 280;

// ------------------------------------------------------------------ photos

/** Photo d'article, ou aplat avec l'initiale : la grille garde toujours la même géométrie (CA-002-03). */
export function ItemPhoto({ item, className, dimmed }: { item: Pick<MenuItem, 'name' | 'imageId'>; className?: string; dimmed?: boolean }) {
  if (item.imageId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photo servie par l'API, déjà réduite
      <img
        src={menuImageUrl(item.imageId)}
        alt={item.name}
        loading="lazy"
        draggable={false}
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
  /** Bouton toujours visible à droite de la recherche (la cloche « Serveur », spec 005). */
  action?: ReactNode;
  /** Contenu placé sous l'en-tête fixe, avant la carte (suivi des commandes en cours). */
  banner?: ReactNode;
  /** Tuile placée en tête de la rangée des rubriques (tuile spéciale « Eau », spec 005). */
  leadingTile?: ReactNode;
  /** Tuile fixe en bout de rangée, isolée des rubriques (tuile « Serveur », spec 005, R9). */
  trailingTile?: ReactNode;
  /** Jeton de la session de table : suggestions « Souvent pris avec » de la fiche d'un plat (spec 012, R7). */
  token?: string;
}

/** Recherche sans accents ni majuscules : « attieke » trouve « Attiéké ». */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function MenuView({ context, cart, onQuantity, action, banner, leadingTile, trailingTile, token }: MenuViewProps) {
  const currency = context.establishment.currency;
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return context.menu;
    return context.menu
      .map((category) => ({ ...category, items: category.items.filter((item) => normalize(`${item.name} ${item.description ?? ''}`).includes(needle)) }))
      .filter((category) => category.items.length > 0);
  }, [context.menu, query]);
  const [active, setActive] = useState(context.menu[0]?.id);
  const [opened, setOpened] = useState<MenuItem | null>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const chips = useRef(new Map<string, HTMLButtonElement>());
  // Rangée des rubriques : savoir s'il reste des tuiles à gauche ou à droite (fondus, flèches).
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measureRow = () => {
    const el = row.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((current) => (current.left === left && current.right === right ? current : { left, right }));
  };
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    // La largeur du contenu change quand les images arrivent : on observe la rangée et chacune de ses tuiles.
    const observer = new ResizeObserver(measureRow);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    const frame = requestAnimationFrame(measureRow);
    // Molette verticale de la souris → défilement horizontal de la rangée, sans faire défiler la page.
    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const atStart = el.scrollLeft <= 0 && event.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && event.deltaY > 0;
      if (atStart || atEnd) return; // au bout de la rangée, la page reprend la main
      event.preventDefault();
      el.scrollBy({ left: event.deltaY, behavior: 'auto' });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, [context.menu.length]);

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
      // Sous l'en-tête fixe (recherche + tuiles, environ 150 px).
      { rootMargin: '-150px 0px -50% 0px' },
    );
    sections.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [context.menu, shown]);

  // Spec 019, R9 : avec un clavier, « / » place le curseur dans la recherche.
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      event.preventDefault();
      search.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (active) chips.current.get(active)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  return (
    <>
      {/* En-tête fixe (spec 005) : recherche et cloche, puis les tuiles des rubriques. */}
      <div className="sticky top-0 z-20 -mx-4 bg-paper/95 px-4 pt-3 pb-1 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              ref={search}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un plat…"
              aria-label="Rechercher dans la carte"
              enterKeyHint="search"
              className="h-12 w-full rounded-full bg-surface pr-11 pl-12 text-[15px] text-ink shadow-sm ring-1 ring-line placeholder:text-ink-3 focus:ring-2 focus:ring-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Effacer la recherche"
                className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-2 hover:bg-sunken"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          {action}
        </div>
        <nav aria-label="Rubriques de la carte" className="flex items-stretch">
          {/* Rangée défilante, prête pour beaucoup de rubriques : fondus sur les bords, molette, arrêt net sur une tuile, flèches au survol. */}
          <div className="group/row relative min-w-0 flex-1">
          <div
            ref={row}
            onScroll={measureRow}
            className="-mx-1 flex snap-x snap-proximity scroll-px-1 gap-1 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pt-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:snap-start"
            style={{
              maskImage: `linear-gradient(to right, ${edges.left ? 'transparent 0, black 28px' : 'black 0'}, ${edges.right ? 'black calc(100% - 28px), transparent 100%' : 'black 100%'})`,
              WebkitMaskImage: `linear-gradient(to right, ${edges.left ? 'transparent 0, black 28px' : 'black 0'}, ${edges.right ? 'black calc(100% - 28px), transparent 100%' : 'black 100%'})`,
            }}
          >
            {leadingTile}
            {context.menu.map((category) => (
              <button
                key={category.id}
                ref={(element) => {
                  if (element) chips.current.set(category.id, element);
                }}
                type="button"
                aria-current={active === category.id ? 'true' : undefined}
                onClick={() => {
                  setQuery('');
                  setActive(category.id);
                  // Après l'effacement de la recherche, la rubrique est de nouveau dans la page.
                  requestAnimationFrame(() => sections.current.get(category.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                }}
                aria-label={category.name}
                className="flex w-16 shrink-0 flex-col items-center gap-1"
              >
                {/* Image d'abord : beaucoup de clients ne lisent pas (spec 003). */}
                <span
                  className={cn(
                    'grid size-12 place-items-center overflow-hidden rounded-xl bg-surface shadow-sm transition-shadow',
                    active === category.id ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'ring-1 ring-line',
                  )}
                >
                  <CategoryImage icon={category.icon} imageId={category.imageId} name="" className="size-full bg-surface" iconClassName="size-6" />
                </span>
                <span className={cn('w-full truncate text-center text-[11px] leading-tight', active === category.id ? 'font-semibold text-ink' : 'text-ink-2')}>
                  {category.name}
                </span>
              </button>
            ))}
          </div>
          {(['left', 'right'] as const).map((side) =>
            edges[side] ? (
              <button
                key={side}
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => row.current?.scrollBy({ left: (side === 'left' ? -1 : 1) * row.current.clientWidth * 0.8, behavior: 'smooth' })}
                className={cn(
                  'absolute top-[1.35rem] z-10 hidden size-8 place-items-center rounded-full bg-surface/95 text-ink shadow-md ring-1 ring-line opacity-0 transition-opacity duration-300 ease-apple group-hover/row:opacity-100 [@media(hover:hover)]:grid',
                  side === 'left' ? 'left-0' : 'right-0',
                )}
              >
                {side === 'left' ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : null,
          )}
          </div>
          {trailingTile && (
            // Isolée des rubriques par un trait fin, et fixe pendant leur défilement.
            <div className="flex shrink-0 items-start pt-3 pb-2 pl-2">
              <span className="mt-1 mr-2 h-10 w-px bg-line" aria-hidden />
              {trailingTile}
            </div>
          )}
        </nav>
      </div>

      {banner}

      {!context.orderingEnabled && (
        <p role="status" className="mt-3 flex items-start gap-2.5 rounded-xl bg-sunken px-3 py-2.5 text-[13px] text-ink-2">
          <PauseCircle className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
          La commande en ligne est suspendue. Vous pouvez consulter la carte et commander auprès du personnel.
        </p>
      )}

      {shown.length === 0 && (
        <div role="status" className="mt-10 flex flex-col items-center gap-2 text-center text-ink-2">
          <SearchX className="size-10 text-ink-3" aria-hidden />
          <p className="text-[15px] font-medium text-ink">Aucun plat trouvé</p>
          <button type="button" onClick={() => setQuery('')} className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-sunken px-4 text-[13px] font-medium text-ink">
            <X className="size-4" aria-hidden />
            Effacer la recherche
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-8">
        {shown.map((category) => (
          <section
            key={category.id}
            id={`cat-${category.id}`}
            ref={(element) => {
              if (element) sections.current.set(category.id, element);
            }}
            aria-labelledby={`title-${category.id}`}
            className="scroll-mt-40"
          >
            <h2 id={`title-${category.id}`} className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-ink">
              <CategoryImage icon={category.icon} imageId={category.imageId} name="" className="size-9 rounded-xl bg-surface ring-1 ring-line" iconClassName="size-5" />
              {category.name}
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 md:gap-x-4 md:gap-y-6 xl:grid-cols-4">
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
          pairings={
            token && context.orderingEnabled && context.pairingsEnabled ? (
              <PairedItems token={token} item={opened} context={context} cart={cart} onAdd={(id) => onQuantity(id, (cart[id] ?? 0) + 1)} />
            ) : undefined
          }
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
        <button
          type="button"
          onClick={onOpen}
          className="block w-full"
          aria-label={`${item.name}, ${price}${item.isAvailable ? '' : ', épuisé'}${quantity > 0 ? `, ${quantity} dans la commande` : ''}`}
        >
          <ItemPhoto item={item} dimmed={!item.isAvailable} className="aspect-square w-full rounded-2xl text-2xl" />
          {item.isAvailable && quantity > 0 && <SelectionChecks quantity={quantity} />}
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
            onClick={(event) => {
              if (quantity > 0) return onOpen();
              haptic();
              flyToCart(event.currentTarget.parentElement?.getBoundingClientRect() ?? null, item.imageId ? menuImageUrl(item.imageId) : null);
              onAdd();
            }}
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

/**
 * Crochets verts de sélection (spec 003, R6) : un crochet par unité, superposés comme une
 * double coche ; on voit « deux » sans savoir lire le 2. Au-delà de 5 : cinq crochets et « + ».
 */
function SelectionChecks({ quantity }: { quantity: number }) {
  const shown = Math.min(quantity, 5);
  return (
    <span
      role="img"
      aria-label={`${quantity} sélectionné${quantity > 1 ? 's' : ''}`}
      className="absolute top-2 left-2 flex items-center rounded-full bg-done py-1 pr-2 pl-1.5 text-white shadow-pop ring-2 ring-surface"
    >
      {Array.from({ length: shown }, (_, index) => (
        <Check key={index} className={cn('size-4', index > 0 && '-ml-2')} strokeWidth={3.5} aria-hidden />
      ))}
      {quantity > 5 && <span className="ml-0.5 text-xs leading-none font-bold">+</span>}
    </span>
  );
}

/** Fiche d'un article (CA-002-04). */
/**
 * Spec 012 : fiche d'un plat, feuille façon iOS.
 * - R1 : photo pleine largeur, poignée, fermeture en tirant vers le bas, croix translucide, effet de profondeur.
 * - R2 : nom, prix, puis description.
 * - R3 : barre d'action fixe « [ − n + ] Ajouter · total », total qui se renouvelle en fondu.
 * - R4 : une vignette du plat par unité.
 * - R6 : états « épuisé » et « déjà dans la commande ».
 */
function ItemSheet({
  item, currency, orderable, inCart, onSave, onClose, pairings,
}: { item: MenuItem; currency: string; orderable: boolean; inCart: number; onSave: (quantity: number) => void; onClose: () => void; pairings?: ReactNode }) {
  const [quantity, setQuantity] = useState(Math.max(1, inCart));
  const canOrder = orderable && item.isAvailable;
  const label = inCart === 0 ? 'Ajouter' : quantity === 0 ? 'Retirer' : 'Mettre à jour';
  const total = formatMoney(quantity * item.priceMinor, currency);

  // R8 : teinte légère tirée de la couleur dominante de la photo ; pas d'effet de profondeur si mouvements réduits.
  const tint = usePhotoTint(item.imageId ? menuImageUrl(item.imageId) : null);
  const [calm] = useState(prefersReducedMotion);
  // R1 : défilement (effet de profondeur sur la photo) et geste « tirer pour fermer ».
  const [scroll, setScroll] = useState(0);
  const [drag, setDrag] = useState<{ startY: number; startTime: number; offset: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const offset = closing ? (sheet.current?.offsetHeight ?? 800) : (drag?.offset ?? 0);
  const close = () => {
    setClosing(true);
    window.setTimeout(onClose, 260);
  };
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({ startY: event.clientY, startTime: performance.now(), offset: 0 });
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, offset: Math.max(0, event.clientY - drag.startY) });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const height = sheet.current?.offsetHeight ?? 600;
    const speed = drag.offset / Math.max(1, performance.now() - drag.startTime); // px par ms
    setDrag(null);
    if (drag.offset > height / 3 || (drag.offset > 40 && speed > 0.8)) close();
  };
  const change = (next: number) => {
    haptic(8);
    setQuantity(Math.max(inCart > 0 ? 0 : 1, Math.min(MAX_QUANTITY, next)));
  };
  const photo = useRef<HTMLDivElement>(null);
  const widePhoto = useRef<HTMLDivElement>(null);
  const save = () => {
    if (quantity > inCart) {
      haptic([10, 40, 14]);
      // À l'horizontale, la photo visible est celle de gauche (spec 019, R6).
      const visible = [photo.current, widePhoto.current].find((el) => el && el.getBoundingClientRect().width > 0);
      flyToCart(visible?.getBoundingClientRect() ?? null, item.imageId ? menuImageUrl(item.imageId) : null);
    }
    onSave(quantity);
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn('fixed inset-0 z-40 bg-ink/45 backdrop-blur-[2px] transition-opacity duration-300', closing ? 'opacity-0' : 'animate-fade-in')}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 animate-sheet-up outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-pop-in md:max-w-[560px] lg:max-w-[720px]"
        >
          <div
            ref={sheet}
            className="flex max-h-[94dvh] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-pop transition-[background-color] duration-700 ease-apple sm:max-h-[88dvh] sm:rounded-[28px] lg:h-[min(560px,86dvh)] lg:flex-row"
            style={{
              // Teinte très douce : 8 % de la couleur de la photo dans le fond de la fiche.
              backgroundColor: tint ? `color-mix(in srgb, ${tint} 8%, var(--color-surface))` : undefined,
              transform: `translateY(${offset}px)`,
              transition: drag ? 'none' : 'transform 380ms var(--ease-spring)',
            }}
          >
            {/* Spec 019, R6 : à l'horizontale, la photo occupe la moitié gauche ; on la tire vers le bas pour fermer, comme sur téléphone. */}
            <div
              ref={widePhoto}
              className="relative hidden w-[46%] shrink-0 touch-none overflow-hidden select-none lg:block"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDragStart={(event) => event.preventDefault()}
              aria-hidden
            >
              <ItemPhoto item={item} dimmed={!item.isAvailable} className="size-full text-6xl" />
              {inCart > 0 && item.isAvailable && (
                <span className="absolute bottom-4 left-4 inline-flex animate-pop-in items-center gap-1.5 rounded-full bg-done px-3 py-1 text-[13px] font-semibold text-white shadow-md">
                  <Check className="size-4" strokeWidth={3} />
                  {inCart} dans votre commande
                </span>
              )}
              {!item.isAvailable && (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-20 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md">
                    <Ban className="size-10" />
                  </span>
                </span>
              )}
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col">
            <DialogPrimitive.Close
              className="absolute top-3 right-3 z-10 hidden size-9 place-items-center rounded-full bg-sunken text-ink-2 transition-transform duration-200 ease-apple active:scale-90 lg:grid"
              aria-label="Fermer"
            >
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" onScroll={(event) => !calm && setScroll(event.currentTarget.scrollTop)}>
              {/* Photo : zone de saisie du geste « tirer pour fermer ». */}
              <div
                ref={photo}
                className="relative touch-none overflow-hidden select-none lg:hidden"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDragStart={(event) => event.preventDefault()}
              >
                <div style={{ transform: `translateY(${scroll * 0.4}px) scale(${1 + Math.min(scroll, 200) / 2000})` }}>
                  <ItemPhoto item={item} dimmed={!item.isAvailable} className="aspect-[4/3] max-h-[46dvh] w-full text-5xl" />
                </div>
                <span className="absolute top-2 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/80 shadow-sm" aria-hidden />
                <DialogPrimitive.Close
                  className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md transition-transform duration-200 ease-apple active:scale-90"
                  aria-label="Fermer"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <X className="size-5" aria-hidden />
                </DialogPrimitive.Close>
                {inCart > 0 && item.isAvailable && (
                  <span className="absolute bottom-3 left-3 inline-flex animate-pop-in items-center gap-1.5 rounded-full bg-done px-3 py-1 text-[13px] font-semibold text-white shadow-md">
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                    {inCart} dans votre commande
                  </span>
                )}
                {!item.isAvailable && (
                  <span className="absolute inset-0 grid place-items-center" aria-hidden>
                    <span className="grid size-20 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md">
                      <Ban className="size-10" />
                    </span>
                  </span>
                )}
              </div>

              <div
                className="relative px-5 pt-4 pb-6 lg:pt-6 lg:pr-14"
                // Dégradé : la couleur de la photo se prolonge sous le titre, puis s'efface.
                style={{ background: tint ? `linear-gradient(to bottom, color-mix(in srgb, ${tint} 16%, var(--color-surface)), transparent 70%)` : undefined }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <DialogPrimitive.Title className="min-w-0 text-[22px] leading-tight font-semibold tracking-tight text-ink">{item.name}</DialogPrimitive.Title>
                  <p className="tabular shrink-0 text-[19px] font-semibold text-brand-strong">{formatMoney(item.priceMinor, currency)}</p>
                </div>
                {item.description && <p className="mt-2 text-sm leading-relaxed text-ink-3">{item.description}</p>}
                {canOrder && (
                  <div className="mt-5 flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-sunken/70 py-2 pr-2 pl-3">
                    <QuantityThumbnails item={item} quantity={quantity} />
                    <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface p-1 shadow-sm ring-1 ring-line">
                      <button
                        type="button"
                        onClick={() => change(quantity - 1)}
                        disabled={quantity <= (inCart > 0 ? 0 : 1)}
                        aria-label={`Retirer un ${item.name}`}
                        className="grid size-10 place-items-center rounded-full text-ink transition-[transform,background-color] duration-200 ease-apple hover:bg-sunken active:scale-90 disabled:opacity-30"
                      >
                        <Minus className="size-5" aria-hidden />
                      </button>
                      <span className="tabular grid w-8 place-items-center overflow-hidden text-lg font-semibold text-ink" aria-live="polite" aria-label={`${quantity} ${item.name}`}>
                        <span key={quantity} className="animate-number-in">
                          {quantity}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => change(quantity + 1)}
                        disabled={quantity >= MAX_QUANTITY}
                        aria-label={`Ajouter un ${item.name}`}
                        className="grid size-10 place-items-center rounded-full bg-ink text-white transition-transform duration-200 ease-apple active:scale-90 disabled:opacity-30"
                      >
                        <Plus className="size-5" aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
                {/* R7 : après le choix du plat principal, les plats souvent pris avec lui. */}
                {canOrder && pairings}
              </div>
            </div>

            {/* R3 : barre d'action, toujours visible, au-dessus des barres du téléphone. */}
            <div
              className="border-t border-line/70 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md"
              style={{ backgroundColor: tint ? `color-mix(in srgb, color-mix(in srgb, ${tint} 8%, var(--color-surface)) 90%, transparent)` : 'color-mix(in srgb, var(--color-surface) 90%, transparent)' }}
            >
              {!item.isAvailable ? (
                <p className="flex h-14 items-center justify-center gap-2 rounded-full bg-sunken text-[15px] font-semibold text-ink-2">
                  <Ban className="size-5" aria-hidden />
                  Épuisé pour le moment
                </p>
              ) : canOrder ? (
                <button
                  type="button"
                  onClick={save}
                  className={cn(
                    'flex h-14 w-full items-center justify-center gap-2 rounded-full px-5 text-[17px] font-semibold text-white shadow-[0_10px_24px_-10px_rgb(27_25_23/0.6)] transition-[transform,background-color] duration-300 ease-apple active:scale-[0.98]',
                    label === 'Retirer' ? 'bg-late' : 'bg-ink',
                  )}
                >
                  {label === 'Retirer' && <Trash2 className="size-5 shrink-0" aria-hidden />}
                  <span>{label}</span>
                  {quantity > 0 && (
                    <span className="tabular overflow-hidden font-normal opacity-85">
                      ·{' '}
                      <span key={total} className="inline-block animate-number-in">
                        {total}
                      </span>
                    </span>
                  )}
                </button>
              ) : null}
            </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Spec 012, R4 : une ou deux vignettes du plat côte à côte ; à partir de 3, elles s'empilent
 * en petite pile (comme des cartes) avec le nombre « ×n » posé dessus.
 */
function QuantityThumbnails({ item, quantity, size = 'md' }: { item: Pick<MenuItem, 'name' | 'imageId'>; quantity: number; size?: 'sm' | 'md' }) {
  const dot = size === 'sm' ? 'size-7' : 'size-10';
  const label = `${quantity} ${item.name} choisi${quantity > 1 ? 's' : ''}`;
  if (quantity <= 0) {
    return (
      <span role="img" aria-label={label} className="text-sm text-ink-3">
        —
      </span>
    );
  }
  if (quantity < 3) {
    return (
      <div role="img" aria-label={label} className="flex items-center gap-1.5">
        {Array.from({ length: quantity }, (_, index) => (
          <span key={index} className="animate-pop-in rounded-full ring-2 ring-surface">
            <ItemPhoto item={item} className={cn(dot, 'rounded-full text-xs')} />
          </span>
        ))}
      </div>
    );
  }
  // Pile : trois vignettes décalées et légèrement tournées ; la clé relance le rebond à chaque ajout.
  return (
    <div role="img" aria-label={label} className={cn('relative', size === 'sm' ? 'h-8 w-11' : 'h-11 w-14')}>
      {[2, 1, 0].map((layer) => (
        <span
          key={layer}
          className="absolute top-0.5 left-0 rounded-full shadow-sm ring-2 ring-surface transition-transform duration-300 ease-spring"
          style={{ transform: `translateX(${layer * 5}px) rotate(${(layer - 1) * 7}deg)`, zIndex: 3 - layer }}
        >
          <ItemPhoto item={item} className={cn(dot, 'rounded-full text-xs')} />
        </span>
      ))}
      <span
        key={quantity}
        className="tabular absolute -top-1 -right-1 z-10 grid h-6 min-w-6 animate-pop-in place-items-center rounded-full bg-done px-1.5 text-[13px] font-bold text-white ring-2 ring-surface"
      >
        ×{quantity}
      </span>
    </div>
  );
}

// ------------------------------------------------------- barre de commande

/** Barre flottante « Voir la commande » (CA-002-06). */
export function CartBar({ count, totalMinor, currency, onOpen }: { count: number; totalMinor: number; currency: string; onOpen: () => void }) {
  // Spec 012, R5 : un rebond quand un plat arrive dans la commande.
  const [bumps, setBumps] = useState(0);
  useEffect(() => {
    const onBump = () => setBumps((n) => n + 1);
    window.addEventListener(CART_BUMP, onBump);
    return () => window.removeEventListener(CART_BUMP, onBump);
  }, []);
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onOpen}
        key={bumps}
        className={cn('pointer-events-auto mx-auto flex h-14 w-full max-w-md items-center md:max-w-[480px] justify-between gap-3 rounded-full bg-ink pr-5 pl-2 text-white shadow-pop active:scale-[0.99]', bumps > 0 && 'animate-cart-bump')}
      >
        <span className="flex items-center gap-3 text-[15px] font-semibold">
          <span className="relative grid size-10 place-items-center rounded-full bg-white/15" {...{ [CART_TARGET_ATTR]: '' }}>
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
  /** Spec 013, R2 : précisions conservées avec le panier (useOrderDetails). */
  details: OrderDetails;
  onDetails: (change: (current: OrderDetails) => OrderDetails) => void;
  token: string;
  context: GuestContext;
  cart: Cart;
  onQuantity: (itemId: string, quantity: number) => void;
  onClose: () => void;
  onOrdered: () => void;
  onContextStale: () => void;
  onSessionClosed: () => void;
  /** Spec 013 : commande enregistrée (le panier peut être vidé) ; l'écran reste ouvert sur la confirmation. */
  onSent: () => void;
}

/** Écran plein écran « Votre commande » (CA-002-07, 08, 09, 12). */
export function OrderScreen(props: OrderScreenProps & { landscape?: boolean }) {
  return <OrderBody {...props} variant="sheet" />;
}

/**
 * Spec 019, R4 : à l'horizontale, le même contenu que la feuille, posé dans le panneau de droite.
 * `onOrdered` : la confirmation est terminée, le panneau repart sur une commande vide.
 */
export function OrderPanel(props: Omit<OrderScreenProps, 'onClose'>) {
  return <OrderBody {...props} onClose={() => undefined} variant="panel" />;
}

/** Contenu de « Votre commande » (spec 013), en feuille sur téléphone ou dans le panneau de la tablette (spec 019, R2). */
function OrderBody({
  token, context, cart, details, onDetails, onQuantity, onClose, onOrdered, onSent, onContextStale, onSessionClosed, variant, landscape = false,
}: OrderScreenProps & { variant: 'sheet' | 'panel'; landscape?: boolean }) {
  const panel = variant === 'panel';
  const queryClient = useQueryClient();
  const currency = context.establishment.currency;
  const { lines, count, totalMinor, hasInvalid } = cartLines(cart, context.menu);
  // Spec 013, R2 : précisions à toucher, et texte libre replié derrière « Autre ».
  const { precisions, note } = details;
  const [freeOpen, setFreeOpen] = useState(() => details.note.trim() !== '');
  // Une clé par intention de commander : un double appui ou une reprise réseau ne crée qu'une commande.
  const [idempotencyKey] = useState(() => randomId());
  // R5 : après l'envoi, la même feuille montre la confirmation et le suivi.
  const [sent, setSent] = useState<GuestRequest | null>(null);
  const total = formatMoney(totalMinor, currency);

  const send = useMutation({
    mutationFn: () =>
      guestApi.order(
        token,
        { items: lines.filter((line) => !line.invalid).map((line) => ({ menuItemId: line.itemId, quantity: line.quantity })), note: composeNote(precisions, note, NOTE_MAX) },
        idempotencyKey,
      ),
    onSuccess: ({ request }) => {
      queryClient.setQueryData<GuestRequest[]>(guestRequestsKey(token), (list = []) => upsert(list, request));
      haptic([18, 60, 18, 60, 30]);
      setSent(request);
      onSent();
    },
    onError: (error) => {
      const http = toHttpError(error);
      if (http.status === 401 || http.code === 'TABLE_SESSION_CLOSED') return onSessionClosed();
      // La carte a changé (rupture, retrait, commande suspendue) : on la relit pour signaler les lignes concernées.
      if (ORDER_ERRORS.has(http.code)) onContextStale();
    },
  });

  const close = () => (sent ? onOrdered() : !send.isPending && onClose());

  // Spec 019, R7 : la tablette passe à l'horizontale pendant que la feuille est ouverte → la commande rejoint le panneau.
  // Jamais pendant un envoi ni sur la confirmation : la commande ne part qu'une fois.
  const busy = send.isPending;
  useEffect(() => {
    if (variant === 'sheet' && landscape && !sent && !busy) onClose();
  }, [variant, landscape, sent, busy, onClose]);

  const content = sent ? (
    <OrderSent token={token} context={context} sent={sent} onDone={onOrdered} autoDoneMs={panel ? PANEL_SENT_MS : undefined} />
  ) : (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* R1 : une carte par plat, la quantité se voit aux vignettes. */}
        <section aria-label="Articles de la commande" className={cn('px-4', panel && 'pt-1')}>
          {lines.length === 0 ? (
            panel ? (
              <EmptyOrder />
            ) : (
              <p className="py-6 text-center text-sm text-ink-2">Votre commande est vide.</p>
            )
          ) : (
            <ul className="flex flex-col gap-2.5" data-order-list="" {...(panel ? { [CART_TARGET_ATTR]: '' } : {})}>
              {lines.map((line, index) => (
                <li
                  key={line.itemId}
                  className={cn('stagger flex animate-item-in items-center gap-3 rounded-2xl p-2.5 ring-1', line.invalid ? 'bg-sunken/70 ring-late/30' : 'bg-surface ring-line')}
                  style={{ '--i': Math.min(index, 10) } as React.CSSProperties}
                >
                  <span className="relative shrink-0">
                    <ItemPhoto item={line.item ?? { name: '?', imageId: null }} dimmed={line.invalid} className="size-16 rounded-xl text-base" />
                    {line.invalid && (
                      <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/35 text-white" aria-hidden>
                        <Ban className="size-7" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[15px] font-semibold', line.invalid ? 'text-ink-3 line-through' : 'text-ink')}>{line.item?.name ?? 'Article retiré'}</p>
                    {line.invalid ? (
                      <p className="flex items-center gap-1 text-[13px] font-medium text-late">
                        <Ban className="size-3.5" aria-hidden />
                        N’est plus disponible
                      </p>
                    ) : (
                      <div className="mt-1 flex items-center gap-2">
                        <QuantityThumbnails item={line.item ?? { name: '?', imageId: null }} quantity={line.quantity} size="sm" />
                        <span className="tabular text-[13px] text-ink-2">{formatMoney((line.item?.priceMinor ?? 0) * line.quantity, currency)}</span>
                      </div>
                    )}
                  </div>
                  {line.invalid ? (
                    <Button variant="danger" size="sm" onClick={() => onQuantity(line.itemId, 0)}>
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
          {/* Bouton rond secondaire : on le comprend au « + », il ne rivalise pas avec le geste pour commander. */}
          {/* Dans le panneau (spec 019), la carte est déjà à côté : pas besoin de « + ». */}
          {!panel && (
            <div className="flex justify-end pt-3 pb-2">
              <button
                type="button"
                onClick={onClose}
                aria-label="Ajouter d’autres articles"
                title="Ajouter d’autres articles"
                className="grid size-11 place-items-center rounded-full bg-surface text-ink shadow-[0_1px_2px_rgb(27_25_23/0.08),0_6px_16px_-6px_rgb(27_25_23/0.25)] ring-1 ring-line/80 transition-[transform,box-shadow] duration-300 ease-spring hover:shadow-[0_1px_2px_rgb(27_25_23/0.08),0_10px_22px_-8px_rgb(27_25_23/0.3)] active:scale-90"
              >
                <Plus className="size-5" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          )}
        </section>

        {(!panel || lines.length > 0) && (
          <>
            {/* R2 : précisions sans écrire. */}
            <section aria-labelledby={panel ? 'precisions-title-panel' : 'precisions-title'} className={cn('px-4 pt-1 pb-5', panel && 'pt-5')}>
              {/* Un panneau « attention » en tête de rangée plutôt qu'un texte : on le reconnaît sans lire. */}
              <div className="-mr-4 flex items-center gap-2.5">
                <h2 id={panel ? 'precisions-title-panel' : 'precisions-title'} className="shrink-0 text-[15px] font-semibold text-ink">
                  <span
                    aria-hidden
                    className="grid size-9 animate-pop-in place-items-center rounded-[10px] bg-gradient-to-b from-[#ffb53d] to-[#f08c00] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_4px_10px_-4px_rgb(240_140_0/0.6)]"
                  >
                    <TriangleAlert className="size-5" strokeWidth={2.4} />
                  </span>
                  <span className="sr-only">Pour la cuisine</span>
                </h2>
                <div className="min-w-0 flex-1">
                  <PrecisionChips
                    className="scroll-pl-1 pr-4 pl-1 [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)]"
                    selected={precisions}
                    onToggle={(key) => onDetails((current) => ({ ...current, precisions: current.precisions.includes(key) ? current.precisions.filter((k) => k !== key) : [...current.precisions, key] }))}
                    freeOpen={freeOpen}
                    onFreeToggle={() => setFreeOpen((open) => !open)}
                  />
                </div>
              </div>
              {freeOpen && (
                <div className="mt-3 animate-fade-in">
                  <Textarea
                    label="Une autre précision"
                    value={note}
                    onChange={(event) => { const value = event.target.value.slice(0, NOTE_MAX); onDetails((current) => ({ ...current, note: value })); }}
                    maxLength={NOTE_MAX}
                    rows={2}
                    placeholder="Ex. : sauce à part"
                    autoFocus={!panel}
                  />
                </div>
              )}
            </section>

            {/* Spec 014, R5 : une idée en plus, tout en bas, juste avant de commander. */}
            <Suggestions token={token} context={context} cart={cart} onAdd={(id) => onQuantity(id, 1)} />
          </>
        )}
      </div>

      {(!panel || lines.length > 0) && (
        <footer className="shrink-0 border-t border-line/70 bg-surface/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            {hasInvalid && !send.isError && <FormError message="Retirez les articles qui ne sont plus disponibles pour commander." />}
            <FormError message={send.isError ? errorMessage(send.error) : null} />
            <p className="flex items-baseline justify-between">
              <span className="text-[15px] font-medium text-ink-2">
                Total · {count} article{count > 1 ? 's' : ''}
              </span>
              <span className="tabular overflow-hidden text-2xl font-semibold tracking-tight text-ink">
                <span key={total} className="inline-block animate-number-in">
                  {total}
                </span>
              </span>
            </p>
            {/* R3 : glisser pour commander, jamais un simple toucher. */}
            <SlideToConfirm
              label="Glisser pour commander"
              detail={total}
              disabled={count === 0 || hasInvalid || !context.orderingEnabled}
              busy={send.isPending}
              onConfirm={() => send.mutate()}
            />
            <p className="text-center text-xs text-ink-3">Le règlement se fait auprès du personnel.</p>
          </div>
        </footer>
      )}
    </>
  );

  if (panel) {
    return (
      <section aria-labelledby="order-panel-title" className="flex min-h-0 flex-1 flex-col">
        <h2 id="order-panel-title" className="shrink-0 px-4 pt-4 pb-3 text-[17px] font-semibold text-ink">
          {sent ? 'Commande envoyée' : 'Votre commande'}
        </h2>
        {content}
      </section>
    );
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink/45 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 animate-sheet-up outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-pop-in md:max-w-[560px]"
        >
          <div className="flex max-h-[94dvh] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-pop sm:max-h-[90dvh] sm:rounded-[28px]">
            <header className="relative flex shrink-0 items-center justify-center px-14 pt-5 pb-3">
              <span className="absolute top-2 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-line" aria-hidden />
              <DialogPrimitive.Title className="text-[17px] font-semibold text-ink">{sent ? 'Commande envoyée' : 'Votre commande'}</DialogPrimitive.Title>
              <DialogPrimitive.Close className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-sunken text-ink-2 transition-transform duration-200 ease-apple active:scale-90" aria-label="Fermer">
                <X className="size-5" aria-hidden />
              </DialogPrimitive.Close>
            </header>

            {content}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Spec 019, R4 : durée de « C'est parti ! » dans le panneau avant de revenir à une commande vide. */
const PANEL_SENT_MS = 6000;

/** Spec 019, R4 : panier vide du panneau, compris sans lire — un sac et un « + ». */
function EmptyOrder() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center" {...{ [CART_TARGET_ATTR]: '' }}>
      <span className="relative grid size-24 place-items-center rounded-full bg-sunken text-ink-3">
        <ShoppingBag className="size-10" strokeWidth={1.75} aria-hidden />
        <span className="absolute -right-1 -bottom-1 grid size-10 place-items-center rounded-full bg-ink text-white shadow-pop ring-4 ring-surface" aria-hidden>
          <Plus className="size-5" strokeWidth={2.5} />
        </span>
      </span>
      <p className="text-[13px] text-ink-3">Touchez + sur un plat pour l’ajouter.</p>
    </div>
  );
}

/**
 * Spec 013, R5 à R7 : confirmation après l'envoi. La coche se dessine, la table et les plats sont rappelés,
 * la frise suit la commande en temps réel, et l'annulation reste possible tant que personne ne l'a prise.
 */
function OrderSent({ token, context, sent, onDone, autoDoneMs }: { token: string; context: GuestContext; sent: GuestRequest; onDone: () => void; autoDoneMs?: number }) {
  const { data } = useQuery({ queryKey: guestRequestsKey(token), queryFn: () => guestApi.requests(token) });
  // Spec 019, R4 : dans le panneau, la confirmation laisse d'elle-même la place au suivi.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (autoDoneMs === undefined) return;
    const timer = window.setTimeout(() => done.current(), autoDoneMs);
    return () => window.clearTimeout(timer);
  }, [autoDoneMs]);
  const live = data?.find((request) => request.id === sent.id) ?? sent;
  const menuItems = new Map(context.menu.flatMap((category) => category.items).map((item) => [item.id, item]));
  const cancelled = live.status === 'cancelled';
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        {cancelled ? (
          <span className="grid size-24 animate-pop-in place-items-center rounded-full bg-sunken text-ink-3">
            <Ban className="size-12" aria-hidden />
          </span>
        ) : (
          <SuccessCheck />
        )}
        <p role="status" className="text-[22px] font-semibold tracking-tight text-ink">
          {cancelled ? 'Commande annulée' : 'C’est parti !'}
        </p>
        <TableBadge label={context.table.label} area={context.table.area} />
      </div>

      <ul className="mt-5 flex flex-wrap justify-center gap-3" aria-label="Plats commandés">
        {live.items.map((line, index) => {
          const item = line.menuItemId ? menuItems.get(line.menuItemId) : undefined;
          return (
            <li key={`${line.menuItemId ?? ''}-${line.name}`} className="stagger flex w-20 animate-item-in flex-col items-center gap-1 text-center" style={{ '--i': index } as React.CSSProperties}>
              <QuantityThumbnails item={item ?? { name: line.name, imageId: null }} quantity={line.quantity} size="sm" />
              <span className="line-clamp-2 text-[12px] leading-tight text-ink-2">{line.name}</span>
            </li>
          );
        })}
      </ul>

      {!cancelled && (
        <div className="mt-6 rounded-2xl bg-sunken/60 p-4">
          <OrderTracker request={live} tone="light" />
        </div>
      )}

      <div className="mt-5 flex flex-col items-center gap-3">
        <CancelOrderButton request={live} token={token} tone="light" />
        <Button size="lg" className="h-14 w-full rounded-full text-base" onClick={onDone}>
          {autoDoneMs === undefined ? 'Retour à la carte' : 'Continuer'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Spec 012, R7 : dans la fiche d'un plat, les plats souvent pris avec lui (suggestions de la spec 002),
 * à ajouter d'un toucher. Une miniature déjà dans la commande porte une coche et son nombre.
 */
function PairedItems({ token, item, context, cart, onAdd }: { token: string; item: MenuItem; context: GuestContext; cart: Cart; onAdd: (itemId: string) => void }) {
  const { data } = useQuery({
    queryKey: ['guest', token, 'suggestions', [item.id]],
    queryFn: () => guestApi.suggestions(token, [item.id]),
    staleTime: 60_000,
  });
  const items = new Map(context.menu.flatMap((category) => category.items).map((entry) => [entry.id, entry]));
  const paired = (data ?? [])
    .map((id) => items.get(id))
    .filter((entry): entry is MenuItem => !!entry && entry.isAvailable && entry.id !== item.id)
    .slice(0, 6);
  if (paired.length === 0) return null;
  return (
    <section aria-labelledby="paired-title" className="mt-5 animate-fade-in">
      <h3 id="paired-title" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
        <Sparkles className="size-4 text-brand" aria-hidden />
        Souvent pris avec
      </h3>
      <ul className="-mx-5 mt-2 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {paired.map((entry, index) => {
          const count = cart[entry.id] ?? 0;
          return (
            <li key={entry.id} className="stagger w-[4.75rem] shrink-0 animate-item-in snap-start" style={{ '--i': index } as React.CSSProperties}>
              <button
                type="button"
                onClick={(event) => {
                  haptic();
                  flyToCart(event.currentTarget.getBoundingClientRect(), entry.imageId ? menuImageUrl(entry.imageId) : null);
                  onAdd(entry.id);
                }}
                aria-label={`Ajouter ${entry.name}${count > 0 ? `, ${count} dans la commande` : ''}`}
                className="group relative block w-full rounded-2xl transition-transform duration-200 ease-apple active:scale-95"
              >
                <ItemPhoto item={entry} className="aspect-square w-full rounded-2xl text-lg" />
                <span
                  className={cn(
                    'absolute right-1 bottom-1 grid size-7 place-items-center rounded-full text-white shadow-md ring-2 ring-surface transition-colors duration-300',
                    count > 0 ? 'bg-done' : 'bg-ink',
                  )}
                >
                  {count > 0 ? (
                    <span key={count} className="tabular animate-pop-in text-[12px] font-bold">
                      {count}
                    </span>
                  ) : (
                    <Plus className="size-4" aria-hidden />
                  )}
                </span>
              </button>
              <p className="mt-1.5 line-clamp-2 text-[12px] leading-tight font-medium text-ink">{entry.name}</p>
              <p className="tabular text-[11px] text-ink-3">{formatMoney(entry.priceMinor, context.establishment.currency)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Rangée « Souvent commandés avec » (CA-002-09, 10). Un échec masque simplement la rangée. */
/**
 * Spec 014 : « Souvent commandés avec », en accompagnement discret tout en bas de la feuille.
 * Vignettes rondes de 64 px (les plats choisis restent dans des cartes plus imposantes),
 * un toucher ajoute le plat, qui vole vers la liste de la commande.
 */
const ORDER_LIST_ATTR = 'data-order-list';

function Suggestions({ token, context, cart, onAdd }: { token: string; context: GuestContext; cart: Cart; onAdd: (itemId: string) => void }) {
  const ids = Object.keys(cart).sort();
  const [leaving, setLeaving] = useState<string | null>(null);
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

  const add = (item: MenuItem, from: DOMRect) => {
    if (leaving) return;
    haptic(10);
    flyToCart(from, item.imageId ? menuImageUrl(item.imageId) : null, document.querySelector(`[${ORDER_LIST_ATTR}]`));
    // R7 : la vignette rétrécit puis quitte la rangée ; sans animation, l'ajout est immédiat.
    if (prefersReducedMotion()) return onAdd(item.id);
    setLeaving(item.id);
    window.setTimeout(() => {
      onAdd(item.id);
      setLeaving(null);
    }, 220);
  };

  return (
    <section aria-labelledby="suggestions-title" className="border-t border-line/70 px-4 pt-4 pb-5">
      <h2 id="suggestions-title" className="mb-3 text-[15px] font-semibold text-ink-2">
        Souvent commandés avec
      </h2>
      <ul
        aria-label="Plats suggérés"
        className="-mx-4 flex snap-x snap-proximity scroll-px-4 gap-2.5 overflow-x-auto overscroll-x-contain px-4 py-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-28px),transparent)] [&::-webkit-scrollbar]:hidden"
      >
        {suggested.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              'stagger w-[72px] shrink-0 animate-item-in snap-start transition-[transform,opacity] duration-200 ease-apple',
              leaving === item.id && 'scale-50 opacity-0',
            )}
            style={{ '--i': Math.min(index, 8) } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={(event) => add(item, event.currentTarget.getBoundingClientRect())}
              aria-label={`Ajouter ${item.name}`}
              className="flex w-full flex-col items-center gap-1 rounded-xl text-center transition-transform duration-200 ease-apple active:scale-95"
            >
              <span className="relative">
                <ItemPhoto item={item} className="size-16 rounded-full text-base" />
                <span aria-hidden className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full bg-ink text-white ring-2 ring-surface">
                  <Plus className="size-3.5" strokeWidth={2.75} />
                </span>
              </span>
              <span className="w-full truncate text-[12px] leading-tight font-medium text-ink">{item.name}</span>
              <span className="tabular -mt-0.5 text-[11px] text-ink-3">{formatMoney(item.priceMinor, context.establishment.currency)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ suivi

/** Hauteur d'une ligne (vignette de 40 px + marges) : la liste en montre deux (spec 016, R3). */
const ORDER_ROW_PX = 52;

/**
 * Contenu d'une commande dans le suivi du client (CA-001-26 ; spec 016) : vignette, nom, « quantité × prix ».
 * Au-delà de deux plats, la liste défile dans son bloc ; un fondu et une flèche montrent la suite.
 */
export function GuestOrderLines({ items, totalMinor, currency, menu }: { items: OrderLine[]; totalMinor: number | null; currency: string; menu: MenuCategory[] }) {
  const list = useRef<HTMLUListElement>(null);
  // Plats encore sous le pli : la pastille « +n » les compte, et disparaît en bas de la liste.
  const [remaining, setRemaining] = useState(0);
  const scrollable = items.length > 2;

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const update = () => setRemaining(Math.max(0, items.length - Math.round((el.scrollTop + el.clientHeight) / ORDER_ROW_PX)));
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, [items.length]);

  if (items.length === 0) return null;
  const atEnd = remaining === 0;
  const more = (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      onClick={() => list.current?.scrollBy({ top: ORDER_ROW_PX * 2, behavior: 'smooth' })}
      className={cn(
        'inline-flex h-6 items-center gap-0.5 rounded-full bg-[#3a3632] pr-1.5 pl-2.5 text-[12px] font-semibold text-white/85 shadow-[0_4px_12px_-4px_rgb(0_0_0/0.6)] ring-1 ring-white/15 transition-[opacity,transform] duration-300 ease-apple',
        atEnd ? 'pointer-events-none scale-75 opacity-0' : 'scale-100 opacity-100',
      )}
    >
      <span className="tabular">+{remaining}</span>
      <ChevronDown className="size-3.5" strokeWidth={2.5} />
    </button>
  );
  const photos = new Map(menu.flatMap((category) => category.items).map((item) => [item.id, item]));

  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-white/[0.07] ring-1 ring-white/10">
      <div className="relative">
        <ul
          ref={list}
          aria-label="Contenu de la commande"
          tabIndex={scrollable ? 0 : undefined}
          className={cn(
            'flex flex-col overflow-y-auto overscroll-contain px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            scrollable && 'snap-y snap-mandatory scroll-smooth outline-none',
          )}
          style={
            scrollable
              ? {
                  maxHeight: ORDER_ROW_PX * 2,
                  // Fondu du bas tant qu'il reste des plats à voir.
                  maskImage: atEnd ? undefined : 'linear-gradient(to bottom, #000 calc(100% - 22px), transparent)',
                  WebkitMaskImage: atEnd ? undefined : 'linear-gradient(to bottom, #000 calc(100% - 22px), transparent)',
                }
              : undefined
          }
        >
          {items.map((line, index) => {
            const item = line.menuItemId ? photos.get(line.menuItemId) : undefined;
            return (
              <li
                key={`${line.menuItemId ?? ''}-${line.name}`}
                className="stagger flex shrink-0 animate-item-in snap-start items-center gap-3 border-b border-white/[0.08] last:border-b-0"
                style={{ height: ORDER_ROW_PX, '--i': Math.min(index, 8) } as React.CSSProperties}
              >
                <ItemPhoto item={item ?? { name: line.name, imageId: null }} className="size-10 shrink-0 rounded-[10px] text-xs ring-1 ring-white/10" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-white">{line.name}</span>
                <span className="tabular shrink-0 text-[13px] whitespace-nowrap">
                  <span className="font-semibold text-white">{line.quantity}</span>
                  <span className="px-1 text-white/45">×</span>
                  <span className="text-white/70">{formatMoney(line.unitPriceMinor, currency)}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {scrollable && totalMinor !== null && <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">{more}</div>}
      </div>
      {/* Sans ligne de total (spec 017), la pastille vit dans un pied fin, sous la liste : elle ne cache aucun plat. */}
      {scrollable && totalMinor === null && <div className="flex h-8 items-center justify-center border-t border-white/10">{more}</div>}
      {totalMinor !== null && (
        <p className="flex items-baseline justify-between border-t border-white/10 bg-white/[0.04] px-3 py-2.5">
          <span className="text-[13px] text-white/60">Total</span>
          <span className="tabular text-[17px] font-semibold tracking-tight text-white">{formatMoney(totalMinor, currency)}</span>
        </p>
      )}
    </div>
  );
}
