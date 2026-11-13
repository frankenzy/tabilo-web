'use client';

import { Flame, ShoppingBag, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { noteFlags, parseNote, precisionTone, type PrecisionTone } from '@/components/pages/guest/order-logic';
import { cn } from '@/lib/utils';

/** Spec 022, R3 et R3 bis : couleur d'une pastille selon ce qu'elle change au service. */
const CHIP: Record<PrecisionTone, string> = {
  takeaway: 'bg-progress-soft text-progress ring-progress/25',
  spicy: 'bg-late-soft text-late ring-late/25',
  default: 'bg-surface text-wait-ink ring-[#f0c46b]',
};

/** Texte libre plus long que ceci : replié sur trois lignes, déplié au toucher (R2). */
const LONG_NOTE = 140;

/**
 * Spec 022, R2 : bandeau « Précisions », en tête d'une commande ou d'une demande.
 * Panneau « attention » ambré du client, pastilles avec leurs pictogrammes, puis le texte libre.
 */
export function PrecisionBanner({ note, className }: { note: string | null | undefined; className?: string }) {
  const parsed = parseNote(note);
  const [expanded, setExpanded] = useState(false);
  if (!parsed) return null;
  const long = (parsed.free?.length ?? 0) > LONG_NOTE;
  return (
    <section aria-label="Précisions du client" className={cn('flex gap-2.5 rounded-xl bg-wait/45 p-2.5 ring-1 ring-[#f0c46b]/70', className)}>
      <span
        aria-hidden
        className="grid size-8 shrink-0 animate-pop-in place-items-center rounded-[9px] bg-gradient-to-b from-[#ffb53d] to-[#f08c00] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_4px_10px_-4px_rgb(240_140_0/0.6)]"
      >
        <TriangleAlert className="size-[18px]" strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        {parsed.precisions.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {parsed.precisions.map(({ key, label, icon: Icon, crossed }) => (
              <li key={key} className={cn('inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-[13px] font-semibold ring-1', CHIP[precisionTone(key)])}>
                <span className="relative grid size-5 place-items-center" aria-hidden>
                  <Icon className="size-4" strokeWidth={2.4} />
                  {crossed && <span className="absolute h-0.5 w-5 rotate-45 rounded-full bg-current" />}
                </span>
                {label}
              </li>
            ))}
          </ul>
        )}
        {parsed.free && (
          <p className={cn('text-[14px] leading-snug font-medium whitespace-pre-wrap text-wait-ink', parsed.precisions.length > 0 && 'mt-1.5', long && !expanded && 'line-clamp-3')}>
            « {parsed.free} »
          </p>
        )}
        {long && (
          <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-[12px] font-semibold text-wait-ink underline underline-offset-2">
            {expanded ? 'Replier' : 'Tout lire'}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Spec 022, R4 et R5 : petits pictogrammes sur l'en-tête d'une commande ou la carte d'une table —
 * panneau ambré (précision), sac bleu (à emporter), piment rouge (piment).
 */
export function PrecisionFlags({ notes, size = 'md', className }: { notes: (string | null | undefined)[]; size?: 'sm' | 'md'; className?: string }) {
  const flags = noteFlags(notes);
  if (!flags.any) return null;
  const box = size === 'sm' ? 'size-4 rounded-[5px]' : 'size-5 rounded-md';
  const icon = size === 'sm' ? 'size-2.5' : 'size-3.5';
  const label = ['avec précisions', flags.takeaway && 'à emporter', flags.spicy && 'piment'].filter(Boolean).join(', ');
  return (
    <span role="img" aria-label={label} title={label} className={cn('inline-flex shrink-0 items-center gap-0.5', className)}>
      <span className={cn('grid animate-pop-in place-items-center bg-gradient-to-b from-[#ffb53d] to-[#f08c00] text-white', box)}>
        <TriangleAlert className={icon} strokeWidth={2.6} />
      </span>
      {flags.takeaway && (
        <span className={cn('grid animate-pop-in place-items-center bg-progress text-white', box)}>
          <ShoppingBag className={icon} strokeWidth={2.6} />
        </span>
      )}
      {flags.spicy && (
        <span className={cn('grid animate-pop-in place-items-center bg-late text-white', box)}>
          <Flame className={icon} strokeWidth={2.6} />
        </span>
      )}
    </span>
  );
}

/** Nom accessible d'une commande : « , avec précisions, à emporter, piment » ou rien (R4). */
export function precisionLabel(note: string | null | undefined): string {
  const flags = noteFlags([note]);
  if (!flags.any) return '';
  return [', avec précisions', flags.takeaway && 'à emporter', flags.spicy && 'piment'].filter(Boolean).join(', ');
}
