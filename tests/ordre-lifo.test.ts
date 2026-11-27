import { describe, expect, it } from 'vitest';
import { newestFirst, tableSheet } from '@/components/pages/requests/table-bill';
import { byUrgency } from '@/components/pages/service/service-order';
import type { ServiceRequest } from '@/contracts';

/** Spec 048 — le plus récent d'abord, groupes épinglés en tête. */

const at = (minute: number) => new Date(Date.UTC(2026, 10, 27, 12, minute)).toISOString();
const request = (id: string, kind: string, minute: number, extra: Partial<ServiceRequest> = {}): ServiceRequest =>
  ({ id, status: 'pending', type: { id: kind, label: kind, icon: 'x', kind }, createdAt: at(minute), priority: 'normal', marker: 0, ...extra }) as unknown as ServiceRequest;

describe('Spec 048 — ordre LIFO', () => {
  it('CA-048-01 — fiche de table : commande, addition, seconde commande → chaque groupe du plus récent au plus ancien, l’addition reste en tête', () => {
    const first = request('o1', 'order', 1);
    const bill = request('b1', 'bill', 2);
    const second = request('o2', 'order', 3);
    const olderBill = request('b0', 'bill', 0, { marker: 1 });
    const sheet = tableSheet([first, bill, second, olderBill], false);
    expect(sheet.bills.map((row) => row.id)).toEqual(['b1', 'b0']);
    expect(sheet.others.map((row) => row.id)).toEqual(['o2', 'o1']);
    expect(sheet.compact).toBe(true);
  });

  it('CA-048-04 — « Service » : une demande prioritaire ancienne reste au-dessus d’une demande normale récente', () => {
    const urgentOld = request('u', 'order', 1, { priority: 'high' } as Partial<ServiceRequest>);
    const recent = request('r', 'order', 9);
    const older = request('o', 'order', 5);
    expect([recent, older, urgentOld].sort(byUrgency).map((row) => row.id)).toEqual(['u', 'r', 'o']);
  });

  it('R1 — newestFirst', () => {
    expect([request('a', 'x', 1), request('b', 'x', 2)].sort(newestFirst).map((row) => row.id)).toEqual(['b', 'a']);
  });
});
