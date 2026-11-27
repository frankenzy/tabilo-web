import { describe, expect, it } from 'vitest';
import { leftMessage } from '@/services/realtime/use-staff-realtime';

/** Spec 047 — fin de visite. CA-047-01 et CA-047-02 (écrans) sont couverts par la recette manuelle. */
describe('Spec 047 — fin de visite', () => {
  it('CA-047-05 — le personnel lit « client parti », et « table libre » quand plus personne n’y est', () => {
    expect(leftMessage('2', true)).toBe('Table 2 · client parti · table libre');
    expect(leftMessage('2', false)).toBe('Table 2 · client parti');
    expect(leftMessage(null, false)).toBe('Une table · client parti');
  });
});
