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

/** Un nœud de la vague (spec 046, R8). `position` : sa place depuis le départ, stable d'une commande à l'autre. */
export type WaveNode = { position: number } & (
  | { kind: 'start' }
  | { kind: 'stamp'; index: number }
  | { kind: 'gift'; id: string; state: GiftState }
  /** Commande restante avant le prochain cadeau (rond vide). */
  | { kind: 'todo'; index: number }
  /** Le prochain cadeau, emballé, à sa place ; `?` si sa place est inconnue. */
  | { kind: 'next'; index: number | null }
);

/**
 * Spec 046, R8 (révisée) : la vague — un rond coché par commande comptée, une boîte à chaque cadeau débloqué
 * (juste après la commande qui l'a débloqué), puis un rond vide par commande restante et la boîte du prochain
 * cadeau à sa place (`nextAt`). On garde les `keepDone` derniers nœuds passés et tous les nœuds à venir ;
 * « Départ » n'apparaît que si le début est visible. Chaque nœud garde sa `position` : la vague ne se retourne pas.
 */
export function waveNodes(
  stamps: number,
  gifts: Pick<LoyaltyGift, 'id' | 'atStamp' | 'state'>[],
  nextAt: number | null = null,
  keepDone = 5,
): WaveNode[] {
  const byStamp = new Map<number, Pick<LoyaltyGift, 'id' | 'atStamp' | 'state'>[]>();
  for (const gift of gifts) {
    const at = Math.min(Math.max(gift.atStamp, 0), stamps);
    byStamp.set(at, [...(byStamp.get(at) ?? []), gift]);
  }
  const all: WaveNode[] = [{ kind: 'start', position: 0 }];
  for (let index = 1; index <= stamps; index += 1) {
    all.push({ kind: 'stamp', index, position: all.length });
    for (const gift of byStamp.get(index) ?? []) all.push({ kind: 'gift', id: gift.id, state: gift.state, position: all.length });
  }
  const done = all.length;
  const target = nextAt !== null && nextAt > stamps ? nextAt : null;
  if (target !== null) {
    for (let index = stamps + 1; index < target; index += 1) all.push({ kind: 'todo', index, position: all.length });
  }
  all.push({ kind: 'next', index: target, position: all.length });
  const from = Math.max(0, done - keepDone);
  return all.slice(from === 1 ? 0 : from);
}

/** Spec 046, R15 : ce qui fait avancer la carte. */
export function countsFrom(minOrderMinor: number, format: (minor: number) => string): string {
  return minOrderMinor > 0 ? `Dès ${format(minOrderMinor)} par visite` : 'Chaque visite compte';
}

/** Spec 046, R8 : « Encore 2 commandes ». */
export function remainingLabel(remaining: number): string {
  return remaining > 1 ? `Encore ${remaining} commandes` : 'Encore 1 commande';
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
