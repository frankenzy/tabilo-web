import { describe, expect, it } from 'vitest';
import { urgencyOf, worstUrgency } from '@/utils/urgency';
import { formatClock, formatDuration } from '@/utils/time';
import { capabilitiesOf } from '@/components/pages/requests/capabilities';
import { upsert } from '@/components/pages/guest/upsert';
import { changePasswordSchema, registerSchema, requestTypeSchema, type GuestRequest, type ServiceRequest } from '@/contracts';

const T0 = Date.parse('2026-11-10T12:00:00Z');
const base = { createdAt: new Date(T0).toISOString(), dueAt: new Date(T0 + 180_000).toISOString() };

describe('urgence d’une demande', () => {
  it('suit le délai cible tant que la demande n’est pas prise en charge', () => {
    expect(urgencyOf({ ...base, status: 'pending' }, T0 + 30_000)).toBe('calm');
    expect(urgencyOf({ ...base, status: 'pending' }, T0 + 90_000)).toBe('waiting');
    expect(urgencyOf({ ...base, status: 'assigned' }, T0 + 180_000)).toBe('late');
  });

  it('ne signale plus de retard une fois la demande acceptée ou terminée', () => {
    expect(urgencyOf({ ...base, status: 'accepted' }, T0 + 600_000)).toBe('progress');
    expect(urgencyOf({ ...base, status: 'in_progress' }, T0 + 600_000)).toBe('progress');
    expect(urgencyOf({ ...base, status: 'resolved' }, T0 + 600_000)).toBe('done');
  });

  it('retient la plus urgente pour colorer une table', () => {
    expect(worstUrgency(['progress', 'calm', 'late', 'waiting'])).toBe('late');
    expect(worstUrgency(['progress', 'calm'])).toBe('calm');
    expect(worstUrgency([])).toBeNull();
  });
});

describe('formats de durée', () => {
  it('affiche des durées lisibles', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(185)).toBe('3 min 05');
    expect(formatDuration(4320)).toBe('1 h 12');
    expect(formatDuration(null)).toBe('—');
  });

  it('affiche un chronomètre', () => {
    expect(formatClock(45)).toBe('0:45');
    expect(formatClock(723)).toBe('12:03');
    expect(formatClock(3730)).toBe('1:02:10');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('actions proposées sur une demande', () => {
  const request = (patch: Partial<ServiceRequest>): ServiceRequest =>
    ({ ...base, status: 'pending', assignee: null, escalationStatus: 'none', ...patch }) as ServiceRequest;
  const waiter = { id: 'w1', can: (p: string) => ['requests.read', 'requests.handle'].includes(p) };
  const manager = { id: 'm1', can: () => true };
  const colleague = { id: 'w2', firstName: 'Fatou', lastName: 'B' };

  it('propose au serveur l’étape suivante de ses propres demandes seulement', () => {
    expect(capabilitiesOf(request({}), waiter).primary?.action).toBe('accept');
    expect(capabilitiesOf(request({ status: 'accepted', assignee: { ...colleague, id: 'w1' } }), waiter).primary?.action).toBe('start');
    expect(capabilitiesOf(request({ status: 'in_progress', assignee: { ...colleague, id: 'w1' } }), waiter).primary?.action).toBe('resolve');
    expect(capabilitiesOf(request({ status: 'accepted', assignee: colleague }), waiter).primary).toBeNull();
    expect(capabilitiesOf(request({ status: 'assigned', assignee: colleague }), waiter).primary).toBeNull();
  });

  it('réserve affectation, annulation et acquittement à la supervision', () => {
    const escalated = request({ escalationStatus: 'escalated' });
    expect(capabilitiesOf(escalated, waiter)).toMatchObject({ assign: false, cancel: false, acknowledge: false });
    expect(capabilitiesOf(escalated, manager)).toMatchObject({ assign: true, cancel: true, acknowledge: true });
    expect(capabilitiesOf(request({ status: 'in_progress', assignee: colleague }), manager).cancel).toBe(false);
  });

  it('ne propose rien sur une demande terminée', () => {
    const done = capabilitiesOf(request({ status: 'resolved', assignee: colleague }), manager);
    expect(done).toMatchObject({ primary: null, assign: false, cancel: false, release: false, transfer: false });
  });
});

describe('suivi client', () => {
  const item = (id: string, status: GuestRequest['status']) => ({ id, status }) as GuestRequest;
  it('met à jour une demande connue et ajoute une nouvelle en tête', () => {
    const list = [item('a', 'pending')];
    expect(upsert(list, item('a', 'accepted'))).toEqual([item('a', 'accepted')]);
    expect(upsert(list, item('b', 'pending')).map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('validation des formulaires', () => {
  it('refuse un mot de passe trop court et normalise l’e-mail', () => {
    const data = { organizationName: 'X SARL', establishmentName: 'Chez X', firstName: 'A', lastName: 'B', email: ' Awa@Example.TEST ', password: 'court' };
    expect(registerSchema.safeParse(data).success).toBe(false);
    const ok = registerSchema.parse({ ...data, password: 'assez-long-ici' });
    expect(ok.email).toBe('awa@example.test');
  });

  it('exige un nouveau mot de passe différent', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'identique-123', newPassword: 'identique-123' }).success).toBe(false);
  });

  it('borne le délai cible d’un type de demande', () => {
    const type = { label: 'Café', icon: 'coffee', priority: 'normal', allowNote: true, isActive: true };
    expect(requestTypeSchema.safeParse({ ...type, slaMinutes: '0.1' }).success).toBe(false);
    expect(requestTypeSchema.parse({ ...type, slaMinutes: '3' }).slaMinutes).toBe(3);
  });
});
