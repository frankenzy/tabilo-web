'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gift, Loader2, StampIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui';
import type { GuestContext, LoyaltyCard, LoyaltyGift } from '@/contracts';
import { cn } from '@/lib/utils';
import { guestApi } from '@/services/api/guest';
import { errorMessage } from '@/services/http';
import { formatMoney } from '@/utils/money';
import { Fireworks } from './fireworks';
import { haptic } from './fly-to-cart';
import { ItemPhoto } from './guest-menu';
import { countsFrom, giftToCelebrate, loyaltyNeedsAttention, loyaltyStatus } from './loyalty-logic';
import { SurpriseSheet } from './surprise-sheet';

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
 * La carte de fidélité du téléphone et ses gestes. Visite ouverte : la carte est présentée (spec 043, R2).
 * Session réglée (spec 046, R7) : elle est seulement relue, pour fêter et déballer.
 */
function useLoyaltyCard(token: string, context: GuestContext, settled: boolean) {
  const queryClient = useQueryClient();
  const establishmentId = context.establishment.key;
  const key = ['guest', token, 'loyalty', settled ? 'settled' : 'open'];
  const card = useQuery({
    queryKey: key,
    enabled: Boolean(establishmentId),
    queryFn: async (): Promise<LoyaltyCard> => {
      if (settled) return guestApi.loyalty(token);
      // R2 : présenter la carte gardée ; à défaut, le serveur en crée une et rend son jeton une seule fois.
      const attached = await guestApi.loyaltyAttach(token, readToken(establishmentId));
      if (attached?.token) writeToken(establishmentId, attached.token);
      return attached;
    },
    // Le tampon et le cadeau arrivent au règlement : on relit la carte de temps en temps.
    refetchInterval: settled ? false : 30_000,
  });
  const patchGift = (updated: LoyaltyGift) =>
    queryClient.setQueryData<LoyaltyCard>(key, (current) =>
      current?.surprise ? { ...current, surprise: { ...current.surprise, gifts: current.surprise.gifts.map((gift) => (gift.id === updated.id ? updated : gift)) } } : current,
    );
  const redeem = useMutation({
    mutationFn: () => guestApi.loyaltyRedeem(token),
    onSuccess: (updated) => queryClient.setQueryData(key, updated),
  });
  const reveal = useMutation({ mutationFn: (giftId: string) => guestApi.giftReveal(token, giftId), onSuccess: patchGift });
  const use = useMutation({ mutationFn: (giftId: string) => guestApi.giftUse(token, giftId), onSuccess: patchGift });
  const celebrated = useMutation({
    mutationFn: (giftId: string) => guestApi.giftCelebrated(token, giftId),
    onMutate: (giftId) =>
      queryClient.setQueryData<LoyaltyCard>(key, (current) =>
        current?.surprise
          ? { ...current, surprise: { ...current.surprise, gifts: current.surprise.gifts.map((gift) => (gift.id === giftId ? { ...gift, celebrate: false } : gift)) } }
          : current,
      ),
  });
  return { card, redeem, reveal, use, celebrated };
}

type LoyaltyHook = ReturnType<typeof useLoyaltyCard>;

/**
 * Spec 047, R5 : cadeaux encore à utiliser (emballés ou gagnés), lus dans la carte déjà chargée par
 * « Réglé · Merci » ; null s'il n'y en a pas.
 */
export function usePendingGifts(token: string | null): { count: number; until: Date } | null {
  const card = useQuery<LoyaltyCard>({ queryKey: ['guest', token, 'loyalty', 'settled'], enabled: false });
  const pending = (card.data?.surprise?.gifts ?? []).filter((gift) => gift.state === 'wrapped' || gift.state === 'won');
  if (pending.length === 0) return null;
  const until = new Date(Math.min(...pending.map((gift) => new Date(gift.expiresAt).getTime())));
  return { count: pending.length, until };
}

/** Spec 046, R7 : feux d'artifice une fois par cadeau débloqué. */
function useCelebration(loyalty: LoyaltyHook) {
  const toCelebrate = giftToCelebrate(loyalty.card.data);
  const [playing, setPlaying] = useState<string | null>(null);
  const { mutate } = loyalty.celebrated;
  useEffect(() => {
    if (toCelebrate && !playing) {
      setPlaying(toCelebrate.id);
      mutate(toCelebrate.id);
    }
  }, [toCelebrate, playing, mutate]);
  return playing ? <Fireworks key={playing} onDone={() => setPlaying(null)} /> : null;
}

/** Le contenu de la fenêtre : carte à tampons (Classique) ou cadeaux surprises. */
function LoyaltySheetBody({ loyalty, context, canUse }: { loyalty: LoyaltyHook; context: GuestContext; canUse: boolean }) {
  const data = loyalty.card.data;
  if (!data) return null;
  if (data.mode === 'surprise') {
    return (
      <>
        <SurpriseSheet
          card={data}
          currency={context.establishment.currency}
          canUse={canUse}
          usingId={loyalty.use.isPending ? (loyalty.use.variables ?? null) : null}
          onReveal={(gift) => loyalty.reveal.mutateAsync(gift.id)}
          onUse={(gift) => loyalty.use.mutate(gift.id)}
        />
        {loyalty.use.isError && <p className="mt-3 text-center text-[13px] text-late">{errorMessage(loyalty.use.error)}</p>}
      </>
    );
  }
  return <ClassicCard loyalty={loyalty} context={context} data={data} />;
}

/**
 * Spec 043, R8 : l'icône cadeau à droite du nom de l'établissement. Elle n'existe que si
 * l'établissement a une carte ; un toucher ouvre la carte en fenêtre.
 * Récompense prête ou cadeau emballé (spec 046, R7) : couleur de l'établissement et pastille.
 */
export function LoyaltyButton({ token, context }: { token: string; context: GuestContext }) {
  const [open, setOpen] = useState(false);
  const loyalty = useLoyaltyCard(token, context, false);
  const fireworks = useCelebration(loyalty);
  const data = loyalty.card.data;
  const status = loyaltyStatus(data);
  if (!data || status === 'none') return null;
  const attention = loyaltyNeedsAttention(status);
  const surprise = data.mode === 'surprise';
  const stamps = Math.min(data.stamps, data.stampsRequired);
  const label = surprise
    ? `Mes cadeaux${status === 'wrapped' ? ', un cadeau à déballer' : ''}`
    : `Carte de fidélité : ${stamps} sur ${data.stampsRequired}${status === 'ready' ? ', récompense prête' : ''}`;

  return (
    <>
      {fireworks}
      <GiftIconButton attention={attention} wiggle={status === 'ready' || status === 'wrapped'} label={label} onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen} title={surprise ? 'Mes cadeaux' : 'Ma carte de fidélité'}>
        <LoyaltySheetBody loyalty={loyalty} context={context} canUse />
      </Dialog>
    </>
  );
}

/**
 * Spec 046, R7 : sur « Réglé · Merci », le cadeau débloqué par ce règlement se fête (feux d'artifice) ;
 * un cadeau emballé avec pastille ouvre la fenêtre pour le déballer. Utiliser attend une visite ouverte.
 */
export function SettledGift({ token, context }: { token: string; context: GuestContext }) {
  const [open, setOpen] = useState(false);
  const loyalty = useLoyaltyCard(token, context, true);
  const fireworks = useCelebration(loyalty);
  const data = loyalty.card.data;
  const wrapped = data?.mode === 'surprise' ? (data.surprise?.gifts.filter((gift) => gift.state === 'wrapped').length ?? 0) : 0;
  // Spec 046, R16 : la visite n'a pas fait avancer la carte, on le dit en image et en chiffres.
  const noStamp = data && !data.visitStamped && data.minOrderMinor > 0 ? <NoStamp minOrder={formatMoney(data.minOrderMinor, context.establishment.currency)} /> : null;
  // Spec 047, R1 : la fenêtre reste ouverte après le déballage du dernier cadeau (elle ne dépend pas du bouton).
  const dialog = data ? (
    <Dialog open={open} onOpenChange={setOpen} title="Mes cadeaux">
      <LoyaltySheetBody loyalty={loyalty} context={context} canUse={false} />
    </Dialog>
  ) : null;
  if (!data || wrapped === 0) {
    return (
      <>
        {fireworks}
        {noStamp}
        {dialog}
      </>
    );
  }
  return (
    <>
      {fireworks}
      {noStamp}
      <button
        type="button"
        onClick={() => {
          haptic(10);
          setOpen(true);
        }}
        aria-label={wrapped > 1 ? `${wrapped} cadeaux à déballer` : 'Un cadeau à déballer'}
        className="group relative mt-2 flex animate-pop-in flex-col items-center gap-2 rounded-3xl bg-gradient-to-b from-brand-soft to-surface px-8 pt-5 pb-4 ring-1 ring-line active:scale-[0.97]"
      >
        <span className="relative grid size-20 place-items-center rounded-[26px] bg-gradient-to-b from-brand to-brand-strong text-white shadow-[0_14px_30px_-10px_var(--color-brand)]">
          <Gift className="size-10 animate-gift-wiggle" strokeWidth={1.8} aria-hidden />
          <span className="absolute -top-1 -right-1 flex size-6" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-late opacity-60" />
            <span className="relative grid size-6 place-items-center rounded-full bg-late text-[12px] font-bold text-white ring-2 ring-surface">{wrapped}</span>
          </span>
        </span>
        <span className="text-[15px] font-semibold text-ink">Voir mon cadeau</span>
      </button>
      {dialog}
    </>
  );
}

/** Spec 046, R16 : un tampon barré et le minimum, en chiffres. */
function NoStamp({ minOrder }: { minOrder: string }) {
  return (
    <p role="status" className="flex animate-pop-in items-center gap-3 rounded-2xl bg-sunken px-4 py-3 text-left">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink-3 ring-1 ring-line" aria-hidden>
        <StampIcon className="size-5" />
        <span className="absolute h-0.5 w-9 rotate-45 rounded-full bg-late" />
      </span>
      <span className="text-[14px] leading-tight">
        <span className="block font-semibold text-ink">Pas de tampon</span>
        <span className="block text-ink-2 tabular-nums">moins de {minOrder}</span>
      </span>
    </p>
  );
}

function GiftIconButton({ attention, wiggle, label, onClick }: { attention: boolean; wiggle: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic(8);
        onClick();
      }}
      aria-label={label}
      className={cn(
        'relative grid size-11 shrink-0 place-items-center rounded-full transition-[transform,background-color,box-shadow] duration-300 ease-apple active:scale-90',
        attention
          ? 'bg-gradient-to-b from-brand to-brand-strong text-white shadow-[0_6px_16px_-6px_var(--color-brand)]'
          : 'bg-surface/80 text-brand-strong shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-4px_rgba(0,0,0,0.12)] ring-1 ring-line backdrop-blur',
      )}
    >
      <Gift className={cn('size-[22px]', wiggle && 'animate-gift-wiggle')} strokeWidth={1.9} aria-hidden />
      {attention && (
        <span className="absolute -top-0.5 -right-0.5 flex size-3.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-late opacity-60" />
          <span className="relative inline-flex size-3.5 rounded-full bg-late ring-2 ring-surface" />
        </span>
      )}
    </button>
  );
}

/** Spec 043 : la carte à tampons du mode Classique. */
function ClassicCard({ loyalty, context, data }: { loyalty: LoyaltyHook; context: GuestContext; data: NonNullable<LoyaltyCard> }) {
  const { redeem } = loyalty;
  const status = loyaltyStatus(data);
  const stamps = Math.min(data.stamps, data.stampsRequired);
  const reward = context.menu.flatMap((category) => category.items).find((item) => item.id === data.rewardItemId);
  return (
    <div className="flex flex-col items-center text-center">
      <span className="relative">
        <ItemPhoto item={reward ?? { name: '?', imageId: null }} className="size-28 rounded-3xl text-2xl shadow-[0_12px_28px_-12px_rgba(0,0,0,0.35)]" />
        <span className="absolute -right-2 -bottom-2 grid size-9 place-items-center rounded-full bg-brand text-white ring-4 ring-surface" aria-hidden>
          <Gift className="size-[18px]" strokeWidth={2} />
        </span>
      </span>
      {reward && <p className="mt-4 text-[17px] font-semibold tracking-tight text-ink">{reward.name}</p>}
      {/* Spec 046, R15 : ce qui fait avancer la carte. */}
      <p className="mt-0.5 text-[12px] font-medium text-ink-3 tabular-nums">{countsFrom(data.minOrderMinor, (minor) => formatMoney(minor, context.establishment.currency))}</p>
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
  );
}
