import type { GiftState, LoyaltyCard, LoyaltyGift } from '@/contracts';

/** Spec 043, R8 et spec 046, R7 : état de la carte tel que l'icône cadeau le montre. */
export type LoyaltyStatus = 'none' | 'progress' | 'ready' | 'pending' | 'validated' | 'wrapped';

export function loyaltyStatus(card: LoyaltyCard | null | undefined): LoyaltyStatus {
  if (!card) return 'none';
  if (card.mode === 'surprise') {
    // Spec 046, R7 : pastille tant qu'un cadeau reste emballé.
    return card.surprise?.gifts.some((gift) => gift.state === 'wrapped') ? 'wrapped' : 'progress';
  }
  if (card.redemption) return card.redemption.validated ? 'validated' : 'pending';
  return card.stamps >= card.stampsRequired ? 'ready' : 'progress';
}

/** La pastille de l'icône : récompense prête, en attente du serveur, ou cadeau à déballer. */
export function loyaltyNeedsAttention(status: LoyaltyStatus): boolean {
  return status === 'ready' || status === 'pending' || status === 'wrapped';
}

/** Spec 046, R7 : le premier cadeau débloqué pas encore fêté (feux d'artifice). */
export function giftToCelebrate(card: LoyaltyCard | null | undefined): LoyaltyGift | null {
  if (card?.mode !== 'surprise') return null;
  return card.surprise?.gifts.find((gift) => gift.celebrate) ?? null;
}

/** Un nœud de la vague (spec 046, R8). */
export type WaveNode =
  | { kind: 'start' }
  | { kind: 'stamp'; index: number }
  | { kind: 'gift'; id: string; state: GiftState }
  | { kind: 'next' };

/**
 * Spec 046, R8 : la vague — un rond coché par commande comptée, une boîte à chaque cadeau débloqué
 * (juste après la commande qui l'a débloqué), un « ? » pour le prochain, sans position.
 * Seuls les `window` derniers nœuds sont gardés ; « Départ » n'apparaît que si le début est visible.
 */
export function waveNodes(stamps: number, gifts: Pick<LoyaltyGift, 'id' | 'atStamp' | 'state'>[], window = 9): WaveNode[] {
  const byStamp = new Map<number, Pick<LoyaltyGift, 'id' | 'atStamp' | 'state'>[]>();
  for (const gift of gifts) {
    const at = Math.min(Math.max(gift.atStamp, 0), stamps);
    byStamp.set(at, [...(byStamp.get(at) ?? []), gift]);
  }
  const body: WaveNode[] = [];
  for (let index = 1; index <= stamps; index += 1) {
    body.push({ kind: 'stamp', index });
    for (const gift of byStamp.get(index) ?? []) body.push({ kind: 'gift', id: gift.id, state: gift.state });
  }
  const visible = body.length > window ? body.slice(body.length - window) : body;
  return [...(visible.length === body.length ? [{ kind: 'start' } as const] : []), ...visible, { kind: 'next' }];
}

/** Spec 046, R9 : part du ruban glissée (0 à 1). */
export function unwrapProgress(dx: number, travel: number): number {
  if (travel <= 0) return 0;
  return Math.min(1, Math.max(0, dx / travel));
}

/** Seuil à partir duquel le cadeau s'ouvre. */
export const UNWRAP_AT = 0.7;

/** Ordre d'affichage des cadeaux : les emballés d'abord (R8). */
export function sortGifts<T extends Pick<LoyaltyGift, 'state' | 'unlockedAt'>>(gifts: T[]): T[] {
  return [...gifts].sort((a, b) => Number(b.state === 'wrapped') - Number(a.state === 'wrapped') || b.unlockedAt.localeCompare(a.unlockedAt));
}
