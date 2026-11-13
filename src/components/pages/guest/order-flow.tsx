'use client';

export { composeNote, PRECISIONS, stepOf, trackingSteps } from './order-logic';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, MapPin, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ActivityIndicator } from '@/components/ui';
import type { GuestRequest } from '@/contracts';
import { cn } from '@/lib/utils';
import { guestApi } from '@/services/api/guest';
import { errorMessage } from '@/services/http';
import { haptic } from './fly-to-cart';
import { LAST_STEP, PRECISIONS, stepOf, trackingSteps } from './order-logic';
import { guestRequestsKey, upsert } from './use-guest-requests';

// ------------------------------------------------------------ R2 précisions

export function PrecisionChips({
  selected, onToggle, freeOpen, onFreeToggle, className = '-mx-4 scroll-px-4 px-4 [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-28px),transparent)]',
}: { selected: string[]; onToggle: (key: string) => void; freeOpen: boolean; onFreeToggle: () => void; className?: string }) {
  return (
    // Une seule ligne qui défile au doigt, de bord à bord de la feuille ; un fondu signale la suite.
    <div
      className={cn(className, 'flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:snap-start')}
      role="group"
      aria-label="Précisions pour la cuisine"
    >
      {PRECISIONS.map(({ key, label, icon: Icon, crossed }) => {
        const on = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => {
              haptic(6);
              onToggle(key);
            }}
            className={cn(
              'inline-flex h-10 items-center gap-1.5 rounded-full pr-3.5 pl-2 text-[13px] font-medium whitespace-nowrap ring-1 transition-[background-color,color,transform] duration-300 ease-spring active:scale-95',
              on ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink ring-line',
            )}
          >
            <span className={cn('relative grid size-7 place-items-center rounded-full', on ? 'bg-white/15' : 'bg-sunken')}>
              <Icon className="size-4" aria-hidden />
              {crossed && <span className="absolute h-0.5 w-5 rotate-45 rounded-full bg-current" aria-hidden />}
            </span>
            {label}
            {on && <CheckCircle2 className="size-4 animate-pop-in text-done" aria-hidden />}
          </button>
        );
      })}
      <button
        type="button"
        aria-expanded={freeOpen}
        onClick={onFreeToggle}
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-full pr-3.5 pl-2 text-[13px] font-medium whitespace-nowrap ring-1 transition-colors duration-300',
          freeOpen ? 'bg-sunken text-ink ring-ink' : 'bg-surface text-ink ring-line',
        )}
      >
        <span className="grid size-7 place-items-center rounded-full bg-sunken">
          <Pencil className="size-4" aria-hidden />
        </span>
        Autre
      </button>
    </div>
  );
}

// ------------------------------------------------- R3 glisser pour commander

/**
 * Spec 013, R3 : « Glisser pour commander ». Un simple toucher n'envoie rien (CA-013-01) : la pastille
 * fait un petit bond qui invite à glisser. Glisser jusqu'au bout, un double toucher ou Entrée au clavier confirment.
 */
export function SlideToConfirm({ label, detail, disabled, busy, onConfirm }: { label: string; detail: string; disabled: boolean; busy: boolean; onConfirm: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ start: number; x: number } | null>(null);
  const knobRef = useRef<HTMLButtonElement>(null);
  const [done, setDone] = useState(false);
  const knob = 56;
  const max = () => Math.max(0, (track.current?.clientWidth ?? 300) - knob - 8);
  const x = done || busy ? max() : (drag?.x ?? 0);

  useEffect(() => {
    if (!busy) setDone(false);
  }, [busy]);

  const confirm = () => {
    if (disabled || busy) return;
    setDone(true);
    haptic([12, 40, 18]);
    onConfirm();
  };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ start: event.clientX, x: 0 });
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    setDrag({ ...drag, x: Math.min(max(), Math.max(0, event.clientX - drag.start)) });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const reached = drag.x >= max() * 0.88;
    const moved = drag.x > 6;
    setDrag(null);
    if (reached) return confirm();
    if (!moved) {
      // Simple toucher : rien n'est envoyé, la pastille montre le geste attendu.
      // On relance l'animation sans recréer le bouton : un double toucher doit viser le même élément.
      haptic(8);
      const el = knobRef.current;
      if (el) {
        el.classList.remove('animate-slide-hint');
        void el.offsetWidth;
        el.classList.add('animate-slide-hint');
      }
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      confirm();
    }
  };
  const progress = max() > 0 ? x / max() : 0;

  return (
    <div
      ref={track}
      className={cn(
        'relative h-16 w-full overflow-hidden rounded-full p-1 transition-colors duration-300',
        disabled ? 'bg-line' : 'bg-ink shadow-[0_12px_28px_-12px_rgb(27_25_23/0.7)]',
      )}
    >
      {/* Remplissage qui suit la pastille. */}
      <span aria-hidden className="absolute inset-y-1 left-1 rounded-full bg-done/90" style={{ width: x + knob, opacity: progress > 0.02 ? 1 : 0, transition: drag ? 'none' : 'width 380ms var(--ease-spring), opacity 300ms' }} />
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 flex flex-col items-center justify-center pr-4 pl-16 leading-tight whitespace-nowrap', disabled ? 'text-ink-3' : 'text-white')}
        style={{ opacity: busy ? 0 : 1 - progress * 1.2 }}
      >
        {/* Le total sur sa propre ligne : rien ne passe sous la pastille, même sur un petit écran. */}
        <span className="text-[16px] font-semibold">{label}</span>
        <span className={cn('tabular text-[13px] font-medium', disabled ? 'text-ink-3' : 'text-white/70')}>{detail}</span>
      </span>
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center gap-2 text-[15px] font-semibold text-white" role="status">
          <ActivityIndicator className="size-5 text-white" />
          Envoi…
        </span>
      )}
      <button
        ref={knobRef}
        type="button"
        disabled={disabled}
        aria-label={`Commander pour ${detail}. Glissez vers la droite, touchez deux fois ou appuyez sur Entrée pour confirmer`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        onDoubleClick={confirm}
        onKeyDown={onKeyDown}
        onAnimationEnd={(event) => event.currentTarget.classList.remove('animate-slide-hint')}
        className="relative z-10 grid touch-none place-items-center rounded-full bg-surface text-ink shadow-md select-none disabled:cursor-not-allowed"
        style={{
          width: knob,
          height: knob,
          transform: `translateX(${x}px)`,
          transition: drag ? 'none' : 'transform 420ms var(--ease-spring)',
        }}
      >
        {busy ? <span className="size-5" /> : <ArrowRight className={cn('size-6', disabled && 'text-ink-3')} aria-hidden />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------- R5 confirmation

/** Spec 013, R5 : grande coche verte qui se dessine. */
export function SuccessCheck() {
  return (
    <svg viewBox="0 0 96 96" className="size-24" aria-hidden>
      <circle cx="48" cy="48" r="44" fill="var(--color-done)" className="animate-pop-in" />
      <path
        d="M28 49 l13 13 l27 -28"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="70"
        strokeDashoffset="70"
        className="animate-draw"
      />
    </svg>
  );
}

// --------------------------------------------------------- R6 frise de suivi

/** Frise à quatre étapes ; l'étape en cours pulse, et le téléphone vibre quand une étape est franchie. */
export function OrderTracker({ request, tone }: { request: Pick<GuestRequest, 'status' | 'type'>; tone: 'dark' | 'light' }) {
  const steps = trackingSteps(request.type.kind === 'order' ? 'order' : 'service');
  const step = stepOf(request);
  const previous = useRef(step);
  useEffect(() => {
    if (step > previous.current) haptic([16, 60, 16]);
    previous.current = step;
  }, [step]);
  const dark = tone === 'dark';
  return (
    <ol className="grid grid-cols-3 gap-x-1" aria-label="Avancement">
      {steps.map(({ label, icon: StepIcon }, index) => (
        <li key={label} aria-current={index === step ? 'step' : undefined} className="relative flex flex-col items-center text-center">
          {index > 0 && (
            <span aria-hidden className={cn('absolute top-[1.125rem] right-[calc(50%+1.375rem)] h-0.5 w-[calc(100%-2.75rem+0.25rem)] -translate-y-1/2 overflow-hidden rounded-full', dark ? 'bg-white/20' : 'bg-line')}>
              <span className={cn('block h-full origin-left bg-brand transition-transform duration-700 ease-apple', index <= step ? 'scale-x-100' : 'scale-x-0')} />
            </span>
          )}
          <span
            className={cn(
              'relative z-10 grid size-9 place-items-center rounded-full transition-colors duration-500',
              index <= step ? 'bg-brand text-white' : dark ? 'bg-[#3a3632] text-white/45' : 'bg-sunken text-ink-3',
              index === step && step < LAST_STEP && 'animate-pulse-step',
            )}
          >
            <StepIcon className="size-[18px]" aria-hidden />
          </span>
          <span className={cn('mt-1.5 block px-0.5 text-[11px] leading-tight text-balance', index <= step ? (dark ? 'text-white' : 'font-semibold text-ink') : dark ? 'text-white/45' : 'text-ink-3')}>
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------ R7 annulation

/**
 * Spec 013, R7 : annuler tant que personne n'a pris la commande. Premier toucher : le bouton passe au rouge
 * « Toucher encore pour annuler » pendant 4 secondes ; second toucher : annulation.
 */
export function CancelOrderButton({ request, token, tone }: { request: Pick<GuestRequest, 'id' | 'status' | 'type'>; token: string; tone: 'dark' | 'light' }) {
  const queryClient = useQueryClient();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);
  const cancel = useMutation({
    mutationFn: () => guestApi.cancel(token, request.id),
    onSuccess: (updated) => queryClient.setQueryData<GuestRequest[]>(guestRequestsKey(token), (list = []) => upsert(list, updated)),
    // Trop tard (déjà prise en charge) : on réaffiche l'état réel, le bouton disparaît.
    onError: () => queryClient.invalidateQueries({ queryKey: guestRequestsKey(token) }),
  });
  if (request.status !== 'pending') return null;
  const order = request.type.kind === 'order';
  return (
    <div>
      <button
        type="button"
        disabled={cancel.isPending}
        onClick={() => {
          haptic(armed ? [10, 30, 10] : 8);
          if (armed) cancel.mutate();
          else setArmed(true);
        }}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-[background-color,color,transform] duration-300 ease-spring active:scale-95 disabled:opacity-50',
          armed ? 'bg-late text-white' : tone === 'dark' ? 'bg-white/10 text-white/85' : 'bg-sunken text-ink-2',
        )}
      >
        <Trash2 className="size-4" aria-hidden />
        {cancel.isPending ? 'Annulation…' : armed ? 'Toucher encore pour annuler' : order ? 'Annuler la commande' : 'Annuler cette demande'}
      </button>
      {cancel.isError && <p className={cn('mt-2 text-[13px]', tone === 'dark' ? 'text-white/80' : 'text-late')}>{errorMessage(cancel.error)}</p>}
    </div>
  );
}

/** Repère de la table sur l'écran de confirmation. */
export function TableBadge({ label, area }: { label: string; area: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-3 py-1 text-[13px] font-medium text-ink-2">
      <MapPin className="size-3.5" aria-hidden />
      Table {label} · {area}
    </span>
  );
}
