'use client';

import { Check, CheckCheck, ChevronsRight, Clock3, Gift, Loader2, PartyPopper, UtensilsCrossed } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { LoyaltyGift } from '@/contracts';
import { cn } from '@/lib/utils';
import { haptic } from './fly-to-cart';
import { ItemPhoto } from './guest-menu';
import { unwrapProgress, UNWRAP_AT } from './loyalty-logic';

const KNOB = 52;

/**
 * Spec 046, R9 : le cadeau emballé. Le nœud glisse le long du ruban ; au-delà de 70 %, le papier s'ouvre
 * et le serveur révèle le lot. Un simple toucher ne déballe pas : le nœud bondit pour montrer le geste.
 */
export function WrappedGift({ onReveal }: { onReveal: () => Promise<unknown> }) {
  const ribbon = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ start: number; x: number } | null>(null);
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  const travel = () => Math.max(1, (ribbon.current?.clientWidth ?? 280) - KNOB);
  const progress = opening ? 1 : unwrapProgress(drag?.x ?? 0, travel());

  const open = () => {
    setOpening(true);
    setFailed(false);
    haptic([12, 50, 24]);
    onReveal().catch(() => {
      setOpening(false);
      setFailed(true);
    });
  };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (opening) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ start: event.clientX, x: 0 });
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    setDrag({ ...drag, x: Math.min(travel(), Math.max(0, event.clientX - drag.start)) });
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const reached = unwrapProgress(drag.x, travel()) >= UNWRAP_AT;
    const moved = drag.x > 6;
    setDrag(null);
    if (reached) return open();
    if (!moved) {
      haptic(8);
      const el = event.currentTarget;
      el.classList.remove('animate-slide-hint');
      void el.offsetWidth;
      el.classList.add('animate-slide-hint');
    }
  };

  // Les deux moitiés du papier s'écartent à mesure qu'on tire le ruban.
  const spread = progress * 70;
  const tilt = progress * 14;
  const paper = 'absolute inset-y-0 w-1/2 bg-brand [background-image:repeating-linear-gradient(135deg,rgb(255_255_255/0.16)_0_10px,transparent_10px_22px)]';

  return (
    <div className="relative">
      <div className="relative h-44 overflow-hidden rounded-3xl bg-gradient-to-b from-brand-soft to-surface ring-1 ring-line">
        {/* Dessous du papier : une lueur, le cadeau attend. */}
        <div className="absolute inset-0 grid place-items-center" aria-hidden>
          <span className={cn('grid size-16 place-items-center rounded-full bg-surface/80 text-brand shadow-pop transition-transform duration-500 ease-apple', opening ? 'scale-110' : 'scale-90')}>
            {opening ? <Loader2 className="size-7 animate-spin" /> : <Gift className="size-7" />}
          </span>
        </div>
        <div
          className={cn(paper, 'left-0 origin-bottom-left rounded-l-3xl')}
          style={{ transform: `translateX(-${spread}%) rotate(-${tilt}deg)`, opacity: 1 - progress * 0.6, transition: drag ? 'none' : 'transform 520ms var(--ease-apple), opacity 520ms' }}
          aria-hidden
        >
          <span className="absolute inset-y-0 right-0 w-3 bg-[#ffd43b] shadow-[inset_-2px_0_0_rgb(0_0_0/0.08)]" />
        </div>
        <div
          className={cn(paper, 'right-0 origin-bottom-right rounded-r-3xl')}
          style={{ transform: `translateX(${spread}%) rotate(${tilt}deg)`, opacity: 1 - progress * 0.6, transition: drag ? 'none' : 'transform 520ms var(--ease-apple), opacity 520ms' }}
          aria-hidden
        >
          <span className="absolute inset-y-0 left-0 w-3 bg-[#ffd43b] shadow-[inset_2px_0_0_rgb(0_0_0/0.08)]" />
        </div>
        {/* Le ruban horizontal : la piste du geste. */}
        <div ref={ribbon} className="absolute inset-x-3 top-1/2 h-[52px] -translate-y-1/2">
          <span
            aria-hidden
            className="absolute inset-x-0 top-1/2 h-5 -translate-y-1/2 rounded-full bg-[#ffd43b] shadow-[0_2px_0_rgb(0_0_0/0.08)]"
            style={{ opacity: 1 - progress, transition: drag ? 'none' : 'opacity 400ms' }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[#8a6d00]"
            style={{ opacity: Math.max(0, 1 - progress * 2) }}
          >
            <ChevronsRight className="size-6 animate-pulse" />
          </span>
          {!opening && (
            <button
              type="button"
              aria-label="Déballer le cadeau. Glissez le nœud vers la droite, ou touchez deux fois"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              onDoubleClick={open}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  open();
                }
              }}
              onAnimationEnd={(event) => event.currentTarget.classList.remove('animate-slide-hint')}
              className="absolute top-0 left-0 grid touch-none place-items-center rounded-full bg-gradient-to-b from-[#ffe066] to-[#fab005] text-[#5c4300] shadow-[0_6px_14px_-4px_rgb(0_0_0/0.35)] ring-4 ring-white/70 select-none"
              style={{
                width: KNOB,
                height: KNOB,
                transform: `translateX(${drag?.x ?? 0}px)`,
                transition: drag ? 'none' : 'transform 420ms var(--ease-spring)',
              }}
            >
              <Bow />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] font-medium text-ink-2">
        <ChevronsRight className="size-4" aria-hidden />
        {failed ? 'Réessayez de déballer' : 'Glissez le nœud pour déballer'}
      </p>
    </div>
  );
}

function Bow() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <path d="M16 16c-3-6-11-8-11-3s8 4 11 3Z" fill="currentColor" opacity="0.85" />
      <path d="M16 16c3-6 11-8 11-3s-8 4-11 3Z" fill="currentColor" opacity="0.85" />
      <path d="M16 16l-4 9M16 16l4 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3.2" fill="currentColor" />
    </svg>
  );
}

const STATE_CHIP: Record<Exclude<LoyaltyGift['state'], 'wrapped'>, { label: string; className: string; icon: typeof Check }> = {
  won: { label: 'Gagné', className: 'bg-done-soft text-done', icon: Check },
  requested: { label: 'Le serveur arrive', className: 'bg-brand-soft text-brand-strong', icon: Loader2 },
  used: { label: 'Utilisé', className: 'bg-sunken text-ink-2', icon: CheckCheck },
  expired: { label: 'Expiré', className: 'bg-sunken text-ink-3', icon: Clock3 },
};

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

const CONFETTI = ['#ffd43b', 'var(--color-brand)', 'var(--color-done)', 'var(--color-progress)', '#f783ac', '#ffa94d'];
const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/**
 * Spec 046, R12 : un cadeau déballé, avec son image et son état ; « Utiliser » s'il est gagné et que la visite est ouverte.
 * Spec 047, R1 et R2 : juste déballé, il s'affiche en grand avec « Youpi ! » et des confettis ; sans visite ouverte,
 * un rappel dit qu'il s'utilise à la prochaine commande.
 */
export function RevealedGift({ gift, canUse, youpi = false, using, onUse }: { gift: LoyaltyGift; canUse: boolean; youpi?: boolean; using: boolean; onUse: () => void }) {
  const state = gift.state === 'wrapped' ? 'won' : gift.state;
  const chip = STATE_CHIP[state];
  const Icon = chip.icon;
  const faded = state === 'used' || state === 'expired';
  useEffect(() => {
    if (youpi) haptic([16, 60, 16, 60, 30]);
  }, [youpi]);
  return (
    <div className={cn('relative', youpi && 'col-span-2')}>
      {youpi && (
        <>
          <span className="pointer-events-none absolute inset-x-0 -top-2 z-10 h-0" aria-hidden>
            {CONFETTI.map((color, index) => (
              <span
                key={index}
                className="absolute h-3 w-2 animate-confetti rounded-[2px]"
                style={{ left: `${10 + index * 16}%`, background: color, animationDelay: `${(index % 3) * 180}ms` }}
              />
            ))}
          </span>
          <p
            role="status"
            className="mx-auto mb-3 flex w-max animate-youpi items-center gap-2 rounded-full bg-done px-4 py-2 text-[18px] font-extrabold tracking-tight text-white shadow-[0_10px_24px_-10px_var(--color-done)]"
          >
            <PartyPopper className="size-5" aria-hidden />
            Youpi !
          </p>
        </>
      )}
      <RevealedCard gift={gift} state={state} chip={chip} Icon={Icon} faded={faded} big={youpi} canUse={canUse} using={using} onUse={onUse} />
      {youpi && !canUse && state === 'won' && (
        <p className="mt-3 flex animate-rise items-center gap-3 rounded-2xl bg-sunken px-3 py-2.5 text-[14px] leading-snug text-ink-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface" aria-hidden>
            <UtensilsCrossed className="size-4" />
          </span>
          <span>
            <strong className="text-ink">Utilisez-le à votre prochaine commande.</strong> À utiliser avant le {longDate.format(new Date(gift.expiresAt))}.
          </span>
        </p>
      )}
    </div>
  );
}

function RevealedCard({
  gift, state, chip, Icon, faded, big, canUse, using, onUse,
}: {
  gift: LoyaltyGift;
  state: Exclude<LoyaltyGift['state'], 'wrapped'>;
  chip: { label: string; className: string };
  Icon: typeof Check;
  faded: boolean;
  big: boolean;
  canUse: boolean;
  using: boolean;
  onUse: () => void;
}) {
  return (
    <article className={cn('flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line', big ? 'animate-youpi shadow-[0_20px_40px_-24px_rgb(27_25_23/0.45)]' : 'animate-pop-in', faded && 'opacity-70')}>
      <ItemPhoto item={{ name: gift.prize?.name ?? 'Cadeau', imageId: gift.prize?.imageId ?? null }} dimmed={faded} className={cn('w-full text-2xl', big ? 'aspect-[16/9]' : 'aspect-[4/3]')} />
      <span className={cn('flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-semibold', chip.className)}>
        <Icon className={cn('size-4', state === 'requested' && 'animate-spin')} aria-hidden />
        {chip.label}
      </span>
      <div className="flex flex-1 flex-col gap-0.5 px-3 pt-2 pb-3">
        <p className={cn('line-clamp-2 font-semibold text-ink', big ? 'text-[18px]' : 'text-[14px]')}>{gift.prize?.name ?? 'Cadeau'}</p>
        <p className="text-[12px] text-ink-3">gagné le {dateFormat.format(new Date(gift.unlockedAt))}</p>
        {state === 'won' && canUse && (
          <button
            type="button"
            disabled={using}
            onClick={() => {
              haptic([10, 40, 14]);
              onUse();
            }}
            className="mt-2 flex h-10 items-center justify-center gap-1.5 rounded-full bg-brand text-[14px] font-semibold text-white active:scale-[0.97] disabled:opacity-60"
          >
            {using ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Gift className="size-4" aria-hidden />}
            Utiliser
          </button>
        )}
      </div>
    </article>
  );
}
