'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gift, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@/components/ui';
import type { GuestContext, LoyaltyCard } from '@/contracts';
import { cn } from '@/lib/utils';
import { guestApi } from '@/services/api/guest';
import { errorMessage } from '@/services/http';
import { haptic } from './fly-to-cart';
import { ItemPhoto } from './guest-menu';
import { loyaltyNeedsAttention, loyaltyStatus } from './loyalty-logic';

const storageKey = (establishmentId: string) => `tabilo.loyalty.${establishmentId}`;

function readToken(establishmentId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(establishmentId));
  } catch {
    return null;
  }
}

function writeToken(establishmentId: string, token: string): void {
  try {
    window.localStorage.setItem(storageKey(establishmentId), token);
  } catch {
    // stockage indisponible : la carte vit le temps de la visite
  }
}

/**
 * Spec 043, R8 : l'icône cadeau à droite du nom de l'établissement. Elle n'existe que si
 * l'établissement a une carte ; un toucher ouvre la carte de tampons en fenêtre.
 * Carte pleine, l'icône prend la couleur de l'établissement et porte une pastille.
 */
export function LoyaltyButton({ token, context }: { token: string; context: GuestContext }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const establishmentId = context.establishment.key;
  const key = ['guest', token, 'loyalty'];
  const card = useQuery({
    queryKey: key,
    enabled: Boolean(establishmentId),
    // R2 : présenter la carte gardée ; à défaut, le serveur en crée une et rend son jeton une seule fois.
    queryFn: async (): Promise<LoyaltyCard> => {
      const attached = await guestApi.loyaltyAttach(token, readToken(establishmentId));
      if (attached?.token) writeToken(establishmentId, attached.token);
      return attached;
    },
    // Le tampon arrive au règlement : on relit la carte de temps en temps.
    refetchInterval: 30_000,
  });
  const redeem = useMutation({
    mutationFn: () => guestApi.loyaltyRedeem(token),
    onSuccess: (updated) => queryClient.setQueryData(key, updated),
  });

  const data = card.data;
  const status = loyaltyStatus(data);
  if (!data || status === 'none') return null;
  const attention = loyaltyNeedsAttention(status);
  const stamps = Math.min(data.stamps, data.stampsRequired);
  const reward = context.menu.flatMap((category) => category.items).find((item) => item.id === data.rewardItemId);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic(8);
          setOpen(true);
        }}
        aria-label={`Carte de fidélité : ${stamps} sur ${data.stampsRequired}${status === 'ready' ? ', récompense prête' : ''}`}
        className={cn(
          'relative grid size-11 shrink-0 place-items-center rounded-full transition-[transform,background-color,box-shadow] duration-300 ease-apple active:scale-90',
          attention
            ? 'bg-gradient-to-b from-brand to-brand-strong text-white shadow-[0_6px_16px_-6px_var(--color-brand)]'
            : 'bg-surface/80 text-brand-strong shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-4px_rgba(0,0,0,0.12)] ring-1 ring-line backdrop-blur',
        )}
      >
        <Gift className={cn('size-[22px]', status === 'ready' && 'animate-gift-wiggle')} strokeWidth={1.9} aria-hidden />
        {attention && (
          <span className="absolute -top-0.5 -right-0.5 flex size-3.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-late opacity-60" />
            <span className="relative inline-flex size-3.5 rounded-full bg-late ring-2 ring-surface" />
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen} title="Ma carte de fidélité">
        <div className="flex flex-col items-center text-center">
          <span className="relative">
            <ItemPhoto item={reward ?? { name: '?', imageId: null }} className="size-28 rounded-3xl text-2xl shadow-[0_12px_28px_-12px_rgba(0,0,0,0.35)]" />
            <span className="absolute -right-2 -bottom-2 grid size-9 place-items-center rounded-full bg-brand text-white ring-4 ring-surface" aria-hidden>
              <Gift className="size-[18px]" strokeWidth={2} />
            </span>
          </span>
          {reward && <p className="mt-4 text-[17px] font-semibold tracking-tight text-ink">{reward.name}</p>}
          <p className="mt-1 text-[28px] font-bold tabular-nums tracking-tight text-ink" aria-hidden>
            {stamps}
            <span className="text-ink-3"> / {data.stampsRequired}</span>
          </p>

          <ol className="mt-4 flex flex-wrap justify-center gap-2" aria-hidden>
            {Array.from({ length: data.stampsRequired }, (_, index) => (
              <li
                key={index}
                className={cn(
                  'grid size-8 place-items-center rounded-full transition-colors',
                  index < data.stamps ? 'bg-brand text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]' : 'bg-sunken ring-1 ring-line',
                )}
              >
                {index < data.stamps && <Check className="size-4" strokeWidth={3.5} />}
              </li>
            ))}
          </ol>

          {status === 'ready' && (
            <button
              type="button"
              disabled={redeem.isPending}
              onClick={() => {
                haptic([10, 40, 14]);
                redeem.mutate();
              }}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold text-white active:scale-[0.98]"
            >
              {redeem.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Gift className="size-5" aria-hidden />}
              Utiliser · {reward?.name ?? 'ma récompense'}
            </button>
          )}
          {data.redemption && (
            <p role="status" className="mt-5 flex items-center gap-2 text-[14px] font-medium text-ink-2">
              {data.redemption.validated ? <Check className="size-5 text-done" aria-hidden /> : <Loader2 className="size-5 animate-spin" aria-hidden />}
              {data.redemption.validated ? 'Offert ! Il arrive.' : 'Le serveur arrive pour valider.'}
            </p>
          )}
          {redeem.isError && <p className="mt-3 text-[13px] text-late">{errorMessage(redeem.error)}</p>}
        </div>
      </Dialog>
    </>
  );
}
