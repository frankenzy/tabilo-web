'use client';

import { Check, Flag, Gift, ShoppingBag } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { LoyaltyCard, LoyaltyGift } from '@/contracts';
import { cn } from '@/lib/utils';
import { RevealedGift, WrappedGift } from './gift-box';
import { sortGifts, waveNodes, type WaveNode } from './loyalty-logic';

const STEP = 64;
const HEIGHT = 92;
const MID = HEIGHT / 2;
const AMPLITUDE = 16;

/**
 * Spec 046, R8 : la fenêtre du mode Surprise — le nombre de cadeaux reçus en grand, la phrase en secondaire,
 * la vague des commandes et des cadeaux, puis « Vos cadeaux » (les emballés d'abord).
 */
export function SurpriseSheet({
  card,
  canUse,
  usingId,
  onReveal,
  onUse,
}: {
  card: NonNullable<LoyaltyCard>;
  /** Utiliser exige une visite ouverte (pas l'écran « Réglé · Merci »). */
  canUse: boolean;
  usingId: string | null;
  onReveal: (gift: LoyaltyGift) => Promise<unknown>;
  onUse: (gift: LoyaltyGift) => void;
}) {
  const surprise = card.surprise ?? { giftsReceived: 0, gifts: [] };
  const gifts = sortGifts(surprise.gifts);
  const wrapped = gifts.filter((gift) => gift.state === 'wrapped');
  const opened = gifts.filter((gift) => gift.state !== 'wrapped');

  return (
    <div className="flex flex-col">
      <header className="relative -mx-5 -mt-1 overflow-hidden bg-gradient-to-b from-brand-soft to-surface px-5 pt-3 pb-5 text-center">
        <GiftArt className="absolute -bottom-3 -left-3 size-24 rotate-[-10deg] opacity-90" />
        <GiftArt className="absolute -top-2 -right-4 size-16 rotate-[14deg] opacity-60" />
        <p className="relative text-[52px] leading-none font-extrabold tracking-tight text-ink tabular-nums">{surprise.giftsReceived}</p>
        <p className="relative mt-1 text-[13px] font-semibold tracking-wide text-ink-2 uppercase">
          {surprise.giftsReceived > 1 ? 'cadeaux reçus' : 'cadeau reçu'}
        </p>
      </header>

      <p className="mt-3 flex items-center justify-center gap-2 text-[13px] text-ink-2">
        <ShoppingBag className="size-4 text-brand" aria-hidden />
        Commandez pour gagner des cadeaux
      </p>

      <Wave nodes={waveNodes(card.stamps, surprise.gifts)} />

      <section className="mt-2">
        <h3 className="mb-2 text-[15px] font-semibold text-ink">Vos cadeaux</h3>
        {gifts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-sunken px-4 py-6 text-center">
            <Gift className="size-8 text-ink-3" aria-hidden />
            <p className="text-[13px] text-ink-2">Votre premier cadeau arrive bientôt.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {wrapped.map((gift) => (
              <WrappedGift key={gift.id} onReveal={() => onReveal(gift)} />
            ))}
            {opened.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {opened.map((gift) => (
                  <RevealedGift key={gift.id} gift={gift} canUse={canUse} using={usingId === gift.id} onUse={() => onUse(gift)} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** La vague : un chemin ondulé, un nœud par commande ou cadeau, défilée jusqu'au plus récent. */
function Wave({ nodes }: { nodes: WaveNode[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const width = Math.max(nodes.length * STEP, 1);
  const points = nodes.map((_, index) => ({ x: STEP / 2 + index * STEP, y: MID + (index % 2 === 0 ? -AMPLITUDE : AMPLITUDE) * 0.6 }));
  const path = points.reduce((acc, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `${acc} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, '');

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [nodes.length]);

  return (
    <div ref={scroller} className="-mx-5 mt-3 overflow-x-auto px-5 [scrollbar-width:none]" aria-hidden>
      <div className="relative" style={{ width, height: HEIGHT }}>
        <svg width={width} height={HEIGHT} className="absolute inset-0">
          <path d={path} fill="none" stroke="var(--color-brand-soft)" strokeWidth={10} strokeLinecap="round" />
          <path d={path} fill="none" stroke="var(--color-brand)" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 9" opacity={0.55} />
        </svg>
        {nodes.map((node, index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2 animate-pop-in"
            style={{ left: points[index].x, top: points[index].y, animationDelay: `${index * 40}ms` }}
          >
            <WaveDot node={node} />
          </span>
        ))}
      </div>
    </div>
  );
}

function WaveDot({ node }: { node: WaveNode }) {
  if (node.kind === 'start') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-brand-strong shadow-sm ring-1 ring-line">
        <Flag className="size-3.5" /> Départ
      </span>
    );
  }
  if (node.kind === 'stamp') {
    return (
      <span className="grid size-8 place-items-center rounded-full bg-brand text-white shadow-[0_3px_8px_-3px_var(--color-brand)] ring-[3px] ring-surface">
        <Check className="size-4" strokeWidth={3.5} />
      </span>
    );
  }
  if (node.kind === 'next') {
    return (
      <span className="grid size-10 place-items-center rounded-full border-2 border-dashed border-brand/60 bg-surface text-[18px] font-extrabold text-brand">?</span>
    );
  }
  const wrapped = node.state === 'wrapped';
  return (
    <span
      className={cn(
        'relative grid size-12 place-items-center rounded-2xl ring-[3px] ring-surface',
        wrapped ? 'bg-gradient-to-b from-brand to-brand-strong text-white shadow-[0_8px_18px_-6px_var(--color-brand)]' : 'bg-brand-soft text-brand-strong',
        (node.state === 'used' || node.state === 'expired') && 'opacity-60',
      )}
    >
      <Gift className={cn('size-6', wrapped && 'animate-gift-wiggle')} strokeWidth={1.9} />
      {!wrapped && (
        <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-done text-white ring-2 ring-surface">
          <Check className="size-3" strokeWidth={3.5} />
        </span>
      )}
    </span>
  );
}

/** Illustration de cadeau du bandeau (dessin, pas une icône). */
function GiftArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('pointer-events-none', className)} aria-hidden>
      <rect x="10" y="26" width="44" height="32" rx="5" fill="var(--color-brand)" />
      <rect x="6" y="18" width="52" height="12" rx="4" fill="var(--color-brand-strong)" />
      <rect x="28" y="18" width="8" height="40" fill="#ffd43b" />
      <path d="M32 18c-4-9-15-11-15-5s11 6 15 5Z" fill="#ffd43b" />
      <path d="M32 18c4-9 15-11 15-5s-11 6-15 5Z" fill="#fab005" />
    </svg>
  );
}
