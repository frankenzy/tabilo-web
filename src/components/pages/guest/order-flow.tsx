'use client';

export { composeNote, PRECISIONS, stepOf, trackingSteps } from './order-logic';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Banknote, CheckCircle2, MapPin, Pencil, Store, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

// ------------------------------------------------------------ spec 030 : payer à la caisse

/** Spec 030, R6 et R11 : billet → caisse, puis le montant — compris sans lire. */
export function PayAtCounter({ amount, tone }: { amount: string; tone: 'dark' | 'light' }) {
  const dark = tone === 'dark';
  const disc = cn('grid size-12 shrink-0 place-items-center rounded-full', dark ? 'bg-white text-pay' : 'bg-pay text-white');
  return (
    <div role="status" aria-label={`Payez ${amount} à la caisse`} className={cn('mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5', dark ? 'bg-white/12 text-white' : 'bg-pay-soft text-pay')}>
      <span className={disc} aria-hidden>
        <Banknote className="size-6" />
      </span>
      <ArrowRight className={cn('size-5 shrink-0', dark ? 'text-white/70' : 'text-pay/70')} aria-hidden />
      <span className={disc} aria-hidden>
        <Store className="size-6" />
      </span>
      <span className="tabular ml-auto text-[22px] font-bold tracking-tight">{amount}</span>
    </div>
  );
}

// ------------------------------------------------------------ R7 annulation

/**
 * Spec 013, R7 : annuler tant que personne n'a pris la commande. Premier toucher : le bouton passe au rouge
 * « Toucher encore pour annuler » pendant 4 secondes ; second toucher : annulation.
 */
export function CancelOrderButton({ request, token, tone }: { request: Pick<GuestRequest, 'id' | 'status' | 'type' | 'paidAt'>; token: string; tone: 'dark' | 'light' }) {
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
  // Spec 030, R5 et R6 : annulable en attente ou à encaisser, jamais une fois réglée.
  if ((request.status !== 'pending' && request.status !== 'awaiting_payment') || request.paidAt) return null;
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
