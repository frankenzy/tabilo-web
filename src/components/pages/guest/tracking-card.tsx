'use client';

import { Check, ChevronDown, RotateCcw, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { requestIcon } from '@/constants/requests';
import type { GuestRequest, MenuCategory } from '@/contracts';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/money';
import { formatTime } from '@/utils/time';
import { haptic, reducedMotion } from './fly-to-cart';
import { GuestOrderLines, ItemPhoto } from './guest-menu';
import { CancelOrderButton, OrderTracker } from './order-flow';
import { LAST_STEP, reorderLines, SERVED_SPOTLIGHT_MS, stepOf, trackingSteps } from './order-logic';

/** Spec 017, R4 : durée du dépliage automatique quand une étape est franchie. */
const AUTO_OPEN_MS = 4000;
/** Spec 018, R3 : durée de la sortie d'une carte. */
const EXIT_MS = 420;
/** Spec 018, R4 : la coche « Ajouté » reste un instant avant que la carte sorte. */
const ADDED_MS = 1100;

interface PagerProps {
  /** Demandes en cours, puis demandes servies dans leur minute « Bon appétit » (spec 018). */
  active: GuestRequest[];
  token: string;
  currency: string;
  menu: MenuCategory[];
  /** Début de la minute « Bon appétit », par demande servie (spec 018, R1). */
  spotlight?: ReadonlyMap<string, number>;
  /** La carte a fini de sortir : fermée par le client ou minute écoulée (R2, R3). */
  onDismiss?: (id: string) => void;
  /** « Recommander » (R4) : `from` est l'endroit touché, point de départ de la vignette qui vole. */
  onReorder?: (request: GuestRequest, from: DOMRect | null) => void;
  /** Spec 019, R4 : dans le panneau de la tablette, les cartes s'empilent, sans pagination. */
  stacked?: boolean;
}

/**
 * Spec 017 : demandes en cours, au-dessus de la carte.
 * Une seule demande : une carte. Plusieurs : une rangée qui défile, une demande par page, avec des points (R5).
 */
export function TrackingPager({ active, token, currency, menu, spotlight, onDismiss, onReorder, stacked = false }: PagerProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const several = active.length > 1 && !stacked;
  // Spec 019, R3 : à la verticale sur tablette, deux demandes tiennent côte à côte ; les points ne servent qu'au-delà.
  const pairFits = active.length === 2;

  useEffect(() => {
    const el = scroller.current;
    if (!el || !several) return;
    const update = () => {
      const width = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth;
      setPage(Math.min(active.length - 1, Math.round(el.scrollLeft / (width + 12))));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, [several, active.length]);

  const goTo = (index: number) => {
    const el = scroller.current;
    const target = el?.children[index] as HTMLElement | undefined;
    if (el && target) el.scrollTo({ left: target.offsetLeft - el.offsetLeft - 16, behavior: 'smooth' });
  };

  return (
    <section aria-label="Vos demandes en cours" className={stacked ? undefined : 'mt-4'}>
      <div
        ref={scroller}
        className={cn(
          several &&
            '-mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-3 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:w-full [&>*]:shrink-0 [&>*]:snap-start md:-mx-6 md:scroll-px-6 md:px-6 md:[&>*]:w-[calc(50%-6px)]',
          stacked && 'flex flex-col gap-3',
        )}
      >
        {active.map((request) => (
          <TrackingCard
            key={request.id}
            request={request}
            token={token}
            currency={currency}
            menu={menu}
            spotlightAt={spotlight?.get(request.id)}
            onDismiss={onDismiss}
            onReorder={onReorder}
          />
        ))}
      </div>
      {several && (
        <div className={cn('mt-1 flex justify-center', pairFits && 'md:hidden')}>
          {active.map((request, index) => (
            <button
              key={request.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Demande ${index + 1} sur ${active.length}`}
              aria-current={index === page ? 'true' : undefined}
              className="grid h-6 w-5 place-items-center"
            >
              <span className={cn('block h-1.5 rounded-full transition-all duration-300 ease-apple', index === page ? 'w-4 bg-ink' : 'w-1.5 bg-ink/25')} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Ligne discrète sous l'étape (spec 017, R2). */
function subtitle(request: GuestRequest, step: number): string {
  // Court : l'étape est déjà écrite au-dessus, la phrase tient sur une ligne d'un petit téléphone.
  if (step === 0) return 'L’équipe est prévenue';
  if (step === 1) return `${request.handledBy ?? 'Quelqu’un'} s’en occupe`;
  return request.type.kind === 'order' ? 'Bon appétit !' : 'Terminée';
}

interface CardProps {
  request: GuestRequest;
  token: string;
  currency: string;
  menu: MenuCategory[];
  spotlightAt?: number;
  onDismiss?: (id: string) => void;
  onReorder?: (request: GuestRequest, from: DOMRect | null) => void;
}

function TrackingCard({ request, token, currency, menu, spotlightAt, onDismiss, onReorder }: CardProps) {
  const order = request.type.kind === 'order';
  const step = stepOf(request);
  const steps = trackingSteps(order ? 'order' : 'service');
  // Spec 018 : servie, dans sa minute « Bon appétit ».
  const served = step === LAST_STEP && spotlightAt !== undefined;
  const canReorder = served && order && onReorder !== undefined && reorderLines(request, menu).length > 0;
  const panelId = useId();
  const [open, setOpen] = useState(served);
  const [leaving, setLeaving] = useState(false);
  const [added, setAdded] = useState(false);
  // Ouverte par le client : le dépliage automatique ne la referme pas (spec 017, R4).
  const pinned = useRef(false);
  const previous = useRef(step);

  useEffect(() => {
    if (step <= previous.current) {
      previous.current = step;
      return;
    }
    previous.current = step;
    // La vibration vient de la frise complète (montée même repliée) : une seule par étape.
    setOpen(true);
    // « Bon appétit » reste déplié pendant toute sa minute (spec 018, R1).
    if (pinned.current || step === LAST_STEP) return;
    const timer = window.setTimeout(() => {
      if (!pinned.current) setOpen(false);
    }, AUTO_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  // Spec 018, R1 : au bout de la minute, la carte sort d'elle-même.
  useEffect(() => {
    if (!served || spotlightAt === undefined) return;
    const timer = window.setTimeout(() => setLeaving(true), Math.max(0, spotlightAt + SERVED_SPOTLIGHT_MS - Date.now()));
    return () => window.clearTimeout(timer);
  }, [served, spotlightAt]);

  // R3 : la sortie se joue, puis la carte quitte la liste.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => onDismiss?.(request.id), reducedMotion() ? 0 : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onDismiss, request.id]);

  // R4 : après la coche « Ajouté », la carte a fait son travail.
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setLeaving(true), ADDED_MS);
    return () => window.clearTimeout(timer);
  }, [added]);

  const toggle = () => {
    haptic(6);
    pinned.current = !open;
    setOpen(!open);
  };

  const close = () => {
    haptic(6);
    setLeaving(true);
  };

  const reorder = (from: DOMRect | null) => {
    if (added) return;
    onReorder?.(request, from);
    setAdded(true);
  };

  return (
    // Sortie (R3) : la carte rétrécit un peu, s'efface, et sa hauteur se replie pour que les voisines se resserrent.
    <div
      aria-hidden={leaving || undefined}
      className={cn(
        'grid origin-top transition-[grid-template-rows,opacity,scale] duration-[420ms] ease-apple',
        leaving ? 'pointer-events-none grid-rows-[0fr] scale-[0.96] opacity-0' : 'grid-rows-[1fr]',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <article aria-label={`${request.type.label}, ${steps[step].label}`} className="relative animate-rise overflow-hidden rounded-2xl bg-ink text-white">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={panelId}
            className={cn('flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-200 active:bg-white/[0.04]', served && 'pr-12')}
          >
            <Thumbs request={request} menu={menu} />
            <div className="min-w-0 flex-1">
              {/* Ligne 1 : l'étape, le total. Ligne 2 : frise miniature, qui s'en occupe, l'heure. */}
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{steps[step].label}</span>
                {order && request.totalMinor !== null && (
                  <span className="tabular shrink-0 text-[15px] font-semibold tracking-tight">{formatMoney(request.totalMinor, currency)}</span>
                )}
                {!served && <ChevronDown className={cn('size-4 shrink-0 text-white/60 transition-transform duration-300 ease-apple', open && 'rotate-180')} aria-hidden />}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <MiniSteps step={step} />
                <p role="status" className="min-w-0 flex-1 truncate text-[12px] text-white/60">
                  {subtitle(request, step)}
                </p>
                <span className="tabular shrink-0 text-[11px] text-white/45">{formatTime(request.createdAt)}</span>
              </div>
            </div>
          </button>

          {served && (
            // R2 : fermer tout de suite. Zone de 44 px, rond discret de 28 px.
            <button type="button" onClick={close} aria-label="Fermer" className="absolute top-1 right-1 grid size-11 place-items-center">
              <span className="grid size-7 place-items-center rounded-full bg-white/10 text-white/75 transition-colors duration-200 active:bg-white/20">
                <X className="size-4" aria-hidden />
              </span>
            </button>
          )}

          {/* Dépliage fluide : la rangée de grille passe de 0 à sa hauteur naturelle (spec 017, R3). */}
          <div
            id={panelId}
            inert={!open}
            // Replié : invisible une fois le repli fini (visibility bascule en fin de transition), comme hors de l'écran.
            className={cn('grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-apple', open ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0')}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="px-3.5 pb-3.5">
                {order && <GuestOrderLines items={request.items} totalMinor={null} currency={currency} menu={menu} />}
                <div className="mt-4">
                  <OrderTracker request={request} tone="dark" />
                </div>
                <div className="mt-3 empty:hidden">
                  <CancelOrderButton request={request} token={token} tone="dark" />
                </div>
                {canReorder && spotlightAt !== undefined && <ReorderButton start={spotlightAt} added={added} onPress={reorder} />}
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

/** Rayon et circonférence de l'anneau du compte à rebours (viewBox de 32). */
const RING_R = 14;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Spec 018, R4 : « Recommander », en pilule de la couleur de la marque.
 * L'anneau autour de la flèche se vide au rythme de la minute restante ; il reste plein si le téléphone demande moins d'animations.
 */
function ReorderButton({ start, added, onPress }: { start: number; added: boolean; onPress: (from: DOMRect | null) => void }) {
  const ring = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = ring.current;
    if (!el || typeof el.animate !== 'function' || reducedMotion()) return;
    const elapsed = Math.min(1, Math.max(0, (Date.now() - start) / SERVED_SPOTLIGHT_MS));
    const animation = el.animate([{ strokeDashoffset: `${RING_C * elapsed}` }, { strokeDashoffset: `${RING_C}` }], {
      duration: (1 - elapsed) * SERVED_SPOTLIGHT_MS,
      easing: 'linear',
      fill: 'forwards',
    });
    return () => animation.cancel();
  }, [start]);

  return (
    <button
      type="button"
      onClick={(event) => {
        haptic(12);
        onPress(event.currentTarget.getBoundingClientRect());
      }}
      aria-label={added ? 'Ajouté à votre commande' : 'Recommander la même commande'}
      className={cn(
        'mt-3 flex h-12 w-full items-center justify-center gap-2.5 rounded-full px-5 text-[15px] font-semibold text-white transition-[background-color,scale,box-shadow] duration-300 ease-apple active:scale-[0.97]',
        added ? 'bg-done' : 'bg-brand shadow-[0_10px_28px_-12px_var(--color-brand)]',
      )}
    >
      {added ? (
        <>
          <span key="ok" className="grid size-8 animate-pop-in place-items-center rounded-full bg-white/20">
            <Check className="size-[18px]" strokeWidth={2.75} aria-hidden />
          </span>
          Ajouté
        </>
      ) : (
        <>
          <span className="relative grid size-8 place-items-center">
            <svg viewBox="0 0 32 32" className="absolute inset-0 size-full -rotate-90" aria-hidden>
              <circle cx="16" cy="16" r={RING_R} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
              <circle
                ref={ring}
                cx="16"
                cy="16"
                r={RING_R}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={0}
              />
            </svg>
            <RotateCcw className="size-4" strokeWidth={2.5} aria-hidden />
          </span>
          Recommander
        </>
      )}
    </button>
  );
}

/** Pile de deux vignettes et « +n » (commande) ou pictogramme et quantité (demande de service). */
export function Thumbs({ request, menu, tone = 'dark' }: { request: GuestRequest; menu: MenuCategory[]; tone?: 'dark' | 'light' }) {
  const ring = tone === 'dark' ? 'ring-ink' : 'ring-surface';
  if (request.type.kind !== 'order') {
    const Icon = requestIcon(request.type.icon);
    return (
      <span className={cn('relative grid size-10 shrink-0 place-items-center rounded-full', tone === 'dark' ? 'bg-white/10' : 'bg-sunken text-ink-2')}>
        <Icon className="size-5" aria-hidden />
        {request.quantity !== null && request.quantity > 1 && (
          <span
            className={cn(
              'tabular absolute -right-1 -bottom-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold',
              tone === 'dark' ? 'bg-white text-ink' : 'bg-ink text-white',
            )}
          >
            ×{request.quantity}
          </span>
        )}
      </span>
    );
  }
  const photos = new Map(menu.flatMap((category) => category.items).map((item) => [item.id, item]));
  const shown = request.items.slice(0, 2);
  const extra = request.items.length - shown.length;
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {shown.map((line, index) => {
        const item = line.menuItemId ? photos.get(line.menuItemId) : undefined;
        return (
          <span key={`${line.menuItemId ?? ''}-${line.name}`} className={cn('rounded-full ring-2', ring, index > 0 && '-ml-4')} style={{ zIndex: 3 - index } as CSSProperties}>
            <ItemPhoto item={item ?? { name: line.name, imageId: null }} className="size-10 rounded-full text-[10px]" />
          </span>
        );
      })}
      {extra > 0 && (
        <span
          className={cn(
            'tabular relative z-10 -ml-2.5 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-semibold ring-2',
            ring,
            tone === 'dark' ? 'bg-white/15' : 'bg-sunken text-ink-2',
          )}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/** Frise miniature : trois segments, l'étape en cours respire (spec 017, R1). */
function MiniSteps({ step }: { step: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            'h-1.5 rounded-full transition-all duration-500 ease-apple',
            index === step ? 'w-4' : 'w-2',
            index <= step ? 'bg-brand' : 'bg-white/20',
            index === step && step < LAST_STEP && 'animate-pulse',
          )}
        />
      ))}
    </span>
  );
}
