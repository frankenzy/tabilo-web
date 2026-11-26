'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gift, Loader2 } from 'lucide-react';
import type { GuestContext, LoyaltyCard } from '@/contracts';
import { cn } from '@/lib/utils';
import { guestApi } from '@/services/api/guest';
import { errorMessage } from '@/services/http';
import { haptic } from './fly-to-cart';
import { ItemPhoto } from './guest-menu';

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
 * Spec 043 : la carte de tampons du client, gardée dans le téléphone (jeton aléatoire, sans compte).
 * Ronds tamponnés, photo de la récompense, coche : tout se comprend à l'image (R6).
 */
export function LoyaltyCardView({ token, context }: { token: string; context: GuestContext }) {
  const queryClient = useQueryClient();
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
  if (!data) return null;
  const full = data.stamps >= data.stampsRequired;
  const reward = context.menu.flatMap((category) => category.items).find((item) => item.id === data.rewardItemId);
  return (
    <section aria-label={`Carte de fidélité : ${Math.min(data.stamps, data.stampsRequired)} sur ${data.stampsRequired}`} className={cn('mt-3 rounded-2xl p-3 ring-1', full ? 'bg-brand-soft ring-brand' : 'bg-surface ring-line')}>
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <ItemPhoto item={reward ?? { name: '?', imageId: null }} className="size-12 rounded-xl text-sm" />
          <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-brand text-white ring-2 ring-surface" aria-hidden>
            <Gift className="size-3" />
          </span>
        </span>
        <ol className="flex flex-1 flex-wrap gap-1" aria-hidden>
          {Array.from({ length: data.stampsRequired }, (_, index) => (
            <li key={index} className={cn('grid size-5 place-items-center rounded-full', index < data.stamps ? 'bg-brand text-white' : 'bg-sunken ring-1 ring-line')}>
              {index < data.stamps && <Check className="size-3" strokeWidth={3.5} />}
            </li>
          ))}
        </ol>
      </div>
      {full && !data.redemption && (
        <button
          type="button"
          disabled={redeem.isPending}
          onClick={() => {
            haptic([10, 40, 14]);
            redeem.mutate();
          }}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold text-white active:scale-[0.98]"
        >
          {redeem.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Gift className="size-5" aria-hidden />}
          Utiliser · {reward?.name ?? 'ma récompense'}
        </button>
      )}
      {data.redemption && (
        <p role="status" className="mt-2 flex items-center gap-2 text-[13px] font-medium text-ink-2">
          {data.redemption.validated ? <Check className="size-4 text-done" aria-hidden /> : <Loader2 className="size-4 animate-spin" aria-hidden />}
          {data.redemption.validated ? 'Offert ! Il arrive.' : 'Le serveur arrive pour valider.'}
        </p>
      )}
      {redeem.isError && <p className="mt-2 text-[13px] text-late">{errorMessage(redeem.error)}</p>}
    </section>
  );
}
