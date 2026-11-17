'use client';

import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ActivityIndicator } from '@/components/ui';
import { cn } from '@/lib/utils';

function haptic(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* vibration indisponible */
  }
}

/** Couleur de la barre : `ink` côté client (spec 013), `done` pour servir et `ready` pour « prête » (spec 025). */
export type SlideTone = 'ink' | 'done' | 'ready';

const TRACK: Record<SlideTone, string> = {
  ink: 'bg-ink shadow-[0_12px_28px_-12px_rgb(27_25_23/0.7)]',
  done: 'bg-done',
  ready: 'bg-ready',
};
const FILL: Record<SlideTone, string> = { ink: 'bg-done/90', done: 'bg-white/25', ready: 'bg-white/25' };

const SIZE = {
  lg: { track: 'h-16', knob: 56, label: 'text-[16px]', icon: 'size-6' },
  md: { track: 'h-12', knob: 40, label: 'text-[14px]', icon: 'size-5' },
} as const;

/**
 * Specs 013 (R3) et 025 (R5) : geste « glisser pour confirmer ». Un simple toucher n'envoie rien :
 * la pastille fait un petit bond qui invite à glisser. Glisser jusqu'au bout, un double toucher ou Entrée confirment.
 */
export function SlideToConfirm({
  label,
  detail,
  ariaLabel,
  disabled = false,
  busy,
  onConfirm,
  size = 'lg',
  tone = 'ink',
  busyLabel = 'Envoi…',
  className,
}: {
  label: string;
  detail?: string;
  /** Nom accessible de la pastille ; la consigne du geste est ajoutée. */
  ariaLabel: string;
  disabled?: boolean;
  busy: boolean;
  onConfirm: () => void;
  size?: keyof typeof SIZE;
  tone?: SlideTone;
  busyLabel?: string;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLButtonElement>(null);
  const [drag, setDrag] = useState<{ start: number; x: number } | null>(null);
  const [done, setDone] = useState(false);
  const { knob, ...look } = SIZE[size];
  const max = () => Math.max(0, (track.current?.clientWidth ?? 300) - knob - 8);
  const x = done || busy ? max() : (drag?.x ?? 0);

  // Fin de l'envoi (réussi ou en erreur) : la pastille revient au début (spec 025, R6).
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
      className={cn('relative w-full overflow-hidden rounded-full p-1 transition-colors duration-300', look.track, disabled ? 'bg-line' : TRACK[tone], className)}
    >
      {/* Remplissage qui suit la pastille. */}
      <span
        aria-hidden
        className={cn('absolute inset-y-1 left-1 rounded-full', FILL[tone])}
        style={{ width: x + knob, opacity: progress > 0.02 ? 1 : 0, transition: drag ? 'none' : 'width 380ms var(--ease-spring), opacity 300ms' }}
      />
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 flex flex-col items-center justify-center pr-4 leading-tight whitespace-nowrap', disabled ? 'text-ink-3' : 'text-white')}
        style={{ opacity: busy ? 0 : 1 - progress * 1.2, paddingLeft: knob + 8 }}
      >
        <span className={cn('font-semibold', look.label)}>{label}</span>
        {/* Le détail (total) sur sa propre ligne : rien ne passe sous la pastille, même sur un petit écran. */}
        {detail && <span className={cn('tabular text-[13px] font-medium', disabled ? 'text-ink-3' : 'text-white/70')}>{detail}</span>}
      </span>
      {busy && (
        <span className={cn('absolute inset-0 flex items-center justify-center gap-2 font-semibold text-white', look.label)} role="status">
          <ActivityIndicator className="size-5 text-white" />
          {busyLabel}
        </span>
      )}
      <button
        ref={knobRef}
        type="button"
        disabled={disabled}
        aria-label={`${ariaLabel}. Glissez vers la droite, touchez deux fois ou appuyez sur Entrée pour confirmer`}
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
        {busy ? <span className="size-5" /> : <ArrowRight className={cn(look.icon, disabled && 'text-ink-3')} aria-hidden />}
      </button>
    </div>
  );
}
