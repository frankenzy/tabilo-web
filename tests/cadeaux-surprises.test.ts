import { describe, expect, it } from 'vitest';
import {
  countsFrom, giftToCelebrate, loyaltyNeedsAttention, loyaltyStatus, remainingLabel, sortGifts, unwrapProgress, UNWRAP_AT, waveNodes,
} from '@/components/pages/guest/loyalty-logic';
import { chanceShare, programSentence } from '@/components/pages/settings/loyalty-prizes-logic';
import { loyaltyCardSchema, type LoyaltyCard, type LoyaltyGift } from '@/contracts';

/** Spec 046 — cadeaux surprises, côté téléphone. */

const gift = (extra: Partial<LoyaltyGift> = {}): LoyaltyGift => ({
  id: 'g1', state: 'wrapped', revealed: false, atStamp: 3, unlockedAt: '2026-11-27T10:00:00.000Z', expiresAt: '2026-12-27T10:00:00.000Z', celebrate: true, prize: null, ...extra,
});
const card = (gifts: LoyaltyGift[], stamps = 3): LoyaltyCard => ({
  mode: 'surprise', stamps, stampsRequired: 10, minOrderMinor: 2000, rewardItemId: null,
  surprise: { giftsReceived: gifts.length, gifts, nextAt: stamps + 2, remaining: 2 }, visitStamped: true, redemption: null,
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

  it('CA-046-13 — la vague : ronds cochés, boîte débloquée, ronds restants puis le prochain cadeau à sa place', () => {
    const nodes = waveNodes(3, [gift({ atStamp: 2, id: 'a' })], 6);
    expect(nodes.map((node) => node.kind)).toEqual(['start', 'stamp', 'stamp', 'gift', 'stamp', 'todo', 'todo', 'next']);
    expect(nodes.at(-1)).toMatchObject({ kind: 'next', index: 6 });
    // Carte neuve, cadeau à la 3e commande : départ, deux ronds vides, la boîte.
    expect(waveNodes(0, [], 3).map((node) => node.kind)).toEqual(['start', 'todo', 'todo', 'next']);
    // Place inconnue (ancienne API) : la boîte « ? » juste après.
    expect(waveNodes(0, []).map((node) => node.kind)).toEqual(['start', 'next']);
    expect(remainingLabel(2)).toBe('Encore 2 commandes');
    expect(remainingLabel(1)).toBe('Encore 1 commande');
  });

  it('R8 — les points gardent leur place : une commande de plus ne retourne pas la vague', () => {
    const before = waveNodes(8, [], 11, 5);
    const after = waveNodes(9, [], 11, 5);
    const at = (nodes: ReturnType<typeof waveNodes>, index: number) => nodes.find((node) => node.kind === 'stamp' && node.index === index)?.position;
    expect(at(before, 8)).toBe(at(after, 8));
    // Le rond vide de la 9e commande devient un rond coché à la même place.
    expect(before.find((node) => node.kind === 'todo' && node.index === 9)?.position).toBe(at(after, 9));
    // Longue carte : seules les 5 dernières commandes, sans « Départ ».
    expect(after[0]).toMatchObject({ kind: 'stamp', index: 5 });
  });

  it('CA-046-15 — ce qui compte, en clair', () => {
    const format = (minor: number) => `${minor} F`;
    expect(countsFrom(2000, format)).toBe('Dès 2000 F par visite');
    expect(countsFrom(0, format)).toBe('Chaque visite compte');
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

describe('Spec 046 — réglages lisibles', () => {
  const format = (minor: number) => `${minor} F`;
  it('CA-046-15 — le réglage en une phrase', () => {
    expect(programSentence({ mode: 'surprise', surpriseMin: 2, surpriseMax: 5, stampsRequired: 10, minOrderMinor: 2000 }, format)).toBe('Un cadeau toutes les 2 à 5 visites d’au moins 2000 F');
    expect(programSentence({ mode: 'surprise', surpriseMin: 3, surpriseMax: 3, stampsRequired: 10, minOrderMinor: 0 }, format)).toBe('Un cadeau toutes les 3 visites');
    expect(programSentence({ mode: 'surprise', surpriseMin: 1, surpriseMax: 1, stampsRequired: 10, minOrderMinor: 0 }, format)).toBe('Un cadeau à chaque visite');
    expect(programSentence({ mode: 'classic', surpriseMin: 2, surpriseMax: 5, stampsRequired: 10, minOrderMinor: 2000 }, format)).toBe('Un plat offert toutes les 10 visites d’au moins 2000 F');
    // Saisie incomplète ou incohérente : pas de phrase.
    expect(programSentence({ mode: 'surprise', surpriseMin: 5, surpriseMax: 2, stampsRequired: 10, minOrderMinor: 0 }, format)).toBeNull();
    expect(programSentence({ mode: 'classic', surpriseMin: 2, surpriseMax: 5, stampsRequired: 10, minOrderMinor: null }, format)).toBeNull();
  });
});
