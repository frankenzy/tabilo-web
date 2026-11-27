import type { LoyaltyCard } from '@/contracts';

/** Spec 043, R8 : état de la carte tel que l'icône cadeau le montre. */
export type LoyaltyStatus = 'none' | 'progress' | 'ready' | 'pending' | 'validated';

export function loyaltyStatus(card: LoyaltyCard | null | undefined): LoyaltyStatus {
  if (!card) return 'none';
  if (card.redemption) return card.redemption.validated ? 'validated' : 'pending';
  return card.stamps >= card.stampsRequired ? 'ready' : 'progress';
}

/** La pastille de l'icône : récompense prête, ou en attente du serveur. */
export function loyaltyNeedsAttention(status: LoyaltyStatus): boolean {
  return status === 'ready' || status === 'pending';
}
