import { describe, expect, it } from 'vitest';
import {
  giftToCelebrate, loyaltyNeedsAttention, loyaltyStatus, sortGifts, unwrapProgress, UNWRAP_AT, waveNodes,
} from '@/components/pages/guest/loyalty-logic';
import { chanceShare } from '@/components/pages/settings/loyalty-prizes-logic';
import { loyaltyCardSchema, type LoyaltyCard, type LoyaltyGift } from '@/contracts';

/** Spec 046 — cadeaux surprises, côté téléphone. */

const gift = (extra: Partial<LoyaltyGift> = {}): LoyaltyGift => ({
  id: 'g1', state: 'wrapped', revealed: false, atStamp: 3, unlockedAt: '2026-11-27T10:00:00.000Z', expiresAt: '2026-12-27T10:00:00.000Z', celebrate: true, prize: null, ...extra,
});
const card = (gifts: LoyaltyGift[], stamps = 3): LoyaltyCard => ({
  mode: 'surprise', stamps, stampsRequired: 10, minOrderMinor: 2000, rewardItemId: null, surprise: { giftsReceived: gifts.length, gifts }, redemption: null,
});

describe('Spec 046 — cadeaux surprises', () => {
  it('CA-046-02 — le téléphone accepte un cadeau emballé sans lot ; une ancienne réponse reste en mode Classique', () => {
    const parsed = loyaltyCardSchema.parse({ mode: 'surprise', stamps: 2, stampsRequired: 10, minOrderMinor: 0, rewardItemId: null, surprise: { giftsReceived: 1, gifts: [gift()] }, redemption: null });
    expect(parsed?.surprise?.gifts[0].prize).toBeNull();
    const legacy = loyaltyCardSchema.parse({ stamps: 2, stampsRequired: 10, minOrderMinor: 0, rewardItemId: 'poulet', redemption: null });
    expect(legacy).toMatchObject({ mode: 'classic', surprise: null });
  });

  it('CA-046-05 — un cadeau emballé met la pastille ; le cadeau à fêter est trouvé une fois', () => {
    expect(loyaltyStatus(card([gift()]))).toBe('wrapped');
    expect(loyaltyNeedsAttention('wrapped')).toBe(true);
    expect(loyaltyStatus(card([gift({ state: 'won', revealed: true, celebrate: false })]))).toBe('progress');
    expect(giftToCelebrate(card([gift()]))?.id).toBe('g1');
    expect(giftToCelebrate(card([gift({ celebrate: false })]))).toBeNull();
  });

  it('R8 — la vague : départ, ronds, boîte après la commande qui la débloque, « ? » au bout', () => {
    const nodes = waveNodes(3, [gift({ atStamp: 2, id: 'a' })]);
    expect(nodes.map((node) => node.kind)).toEqual(['start', 'stamp', 'stamp', 'gift', 'stamp', 'next']);
    // Longue carte : seuls les derniers nœuds, sans « Départ ».
    const long = waveNodes(20, [], 9);
    expect(long).toHaveLength(10);
    expect(long[0]).toEqual({ kind: 'stamp', index: 12 });
    expect(long.at(-1)).toEqual({ kind: 'next' });
    // Carte neuve : départ et « ? ».
    expect(waveNodes(0, []).map((node) => node.kind)).toEqual(['start', 'next']);
  });

  it('CA-046-06 — le cadeau s’ouvre au-delà de 70 % du ruban', () => {
    expect(unwrapProgress(-10, 200)).toBe(0);
    expect(unwrapProgress(150, 200)).toBeGreaterThanOrEqual(UNWRAP_AT);
    expect(unwrapProgress(100, 200)).toBeLessThan(UNWRAP_AT);
    expect(unwrapProgress(400, 200)).toBe(1);
  });

  it('R8 — les cadeaux emballés d’abord, puis du plus récent au plus ancien', () => {
    const sorted = sortGifts([
      gift({ id: 'old', state: 'won', unlockedAt: '2026-11-01T00:00:00.000Z' }),
      gift({ id: 'wrapped', state: 'wrapped', unlockedAt: '2026-10-01T00:00:00.000Z' }),
      gift({ id: 'new', state: 'used', unlockedAt: '2026-11-20T00:00:00.000Z' }),
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['wrapped', 'new', 'old']);
  });
});

describe('Spec 046 — panier du gérant', () => {
  it('R2 — la chance s’affiche en pourcentage du total', () => {
    const prizes = [{ weight: 50 }, { weight: 40 }, { weight: 10 }];
    expect(prizes.map((prize) => chanceShare(prize.weight, prizes))).toEqual([50, 40, 10]);
    expect(chanceShare(1, [{ weight: 1 }, { weight: 2 }])).toBe(33);
    expect(chanceShare(5, [])).toBe(0);
  });
});
