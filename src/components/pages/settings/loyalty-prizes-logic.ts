import type { LoyaltyPrize } from '@/contracts';

/** Spec 046, R2 : part de chance d'un lot, en pourcentage arrondi du total des chances. */
export function chanceShare(weight: number, prizes: Pick<LoyaltyPrize, 'weight'>[]): number {
  const total = prizes.reduce((sum, prize) => sum + prize.weight, 0);
  return total === 0 ? 0 : Math.round((weight / total) * 100);
}
