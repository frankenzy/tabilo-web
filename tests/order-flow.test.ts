import { describe, expect, it } from 'vitest';
import { composeNote, stepOf, trackingSteps } from '@/components/pages/guest/order-logic';

/** Spec 013 — validation de la commande (specs/013-validation-commande/spec.md). */
describe('Spec 013 — note composée et frise de suivi', () => {
  it('CA-013-03 — « Sans piment » et « Bien frais » donnent la note « Sans piment · Bien frais »', () => {
    expect(composeNote(['bien-frais', 'sans-piment'], '', 280)).toBe('Sans piment · Bien frais');
  });

  it('CA-013-03 — le texte libre suit les pastilles ; sans rien, aucune note', () => {
    expect(composeNote(['sans-oignon'], '  sauce à part ', 280)).toBe('Sans oignon · sauce à part');
    expect(composeNote([], '   ', 280)).toBeUndefined();
    expect(composeNote(['inconnue'], '', 280)).toBeUndefined();
  });

  it('CA-013-03 — la note ne dépasse jamais la longueur permise', () => {
    expect(composeNote(['sans-piment'], 'x'.repeat(400), 280)).toHaveLength(280);
  });

  it('CA-013-04 — la frise d’une commande : Envoyée, Prise en charge, En préparation, Servie', () => {
    expect(trackingSteps('order').map((s) => s.label)).toEqual(['Envoyée', 'Prise en charge', 'En préparation', 'Servie']);
    expect(trackingSteps('service').map((s) => s.label)).toEqual(['Envoyée', 'Prise en charge', 'En cours', 'Terminée']);
  });

  it('CA-013-04 — chaque statut tombe sur la bonne étape', () => {
    const steps = (['pending', 'assigned', 'accepted', 'in_progress', 'resolved'] as const).map((status) => stepOf({ status }));
    expect(steps).toEqual([0, 0, 1, 2, 3]);
  });
});
