import { describe, expect, it } from 'vitest';
import { composeNote, noteFlags, parseNote } from '@/components/pages/guest/order-logic';

/** Spec 022 — précisions visibles côté personnel (specs/022-precisions-visibles/spec.md). */
describe('Spec 022 — précisions du client', () => {
  it('CA-022-01 — la note composée redevient des pastilles et un texte libre', () => {
    const parsed = parseNote('Sans piment · À emporter · sauce à part')!;
    expect(parsed.precisions.map((p) => p.key)).toEqual(['sans-piment', 'a-emporter']);
    expect(parsed.free).toBe('sauce à part');
    expect(parsed.takeaway).toBe(true);
    expect(parsed.spicy).toBe(true);
  });

  it('CA-022-01 — même découpage que la note envoyée par le client (spec 013)', () => {
    const note = composeNote(['peu-pimente', 'sans-glacons'], 'bien cuit', 280);
    const parsed = parseNote(note)!;
    expect(parsed.precisions.map((p) => p.key)).toEqual(['peu-pimente', 'sans-glacons']);
    expect(parsed.free).toBe('bien cuit');
  });

  it('CA-022-04 — une ancienne note libre reste du texte, sans pastille', () => {
    expect(parseNote('pas de sel')).toEqual({ precisions: [], free: 'pas de sel', takeaway: false, spicy: false });
    expect(parseNote('   ')).toBeNull();
    expect(parseNote(null)).toBeNull();
  });

  it('CA-022-02, 03 — une commande ou une table signale précision, emporter et piment', () => {
    expect(noteFlags([null, 'Bien frais'])).toEqual({ any: true, takeaway: false, spicy: false });
    expect(noteFlags(['À emporter', 'Pas trop pimenté'])).toEqual({ any: true, takeaway: true, spicy: true });
    expect(noteFlags([null, undefined])).toEqual({ any: false, takeaway: false, spicy: false });
  });
});
