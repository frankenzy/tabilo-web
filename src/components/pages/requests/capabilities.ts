import type { ServiceRequest } from '@/contracts';
import type { RequestAction } from '@/services/api';
import { isOrder, nextStep, type StepTone } from '@/components/pages/orders/orders-logic';

export interface Viewer {
  id: string;
  can: (permission: string) => boolean;
}

export interface PrimaryAction {
  action: RequestAction;
  label: string;
  /** Spec 025 : une commande se marque prête ou servie en glissant, pas d'un toucher. */
  gesture: 'tap' | 'slide';
  tone?: StepTone;
}

interface Capabilities {
  primary: PrimaryAction | null;
  assign: boolean;
  transfer: boolean;
  release: boolean;
  cancel: boolean;
  acknowledge: boolean;
}

/** Ce que l'utilisateur peut proposer sur une demande. Reflète les règles de l'API, qui reste seule juge. */
export function capabilitiesOf(request: ServiceRequest, viewer: Viewer, separateKitchen = false): Capabilities {
  const mine = request.assignee?.id === viewer.id;
  const handle = viewer.can('requests.handle');
  const supervise = viewer.can('requests.assign');
  const own = handle && (mine || supervise);
  let primary: Capabilities['primary'] = null;
  // Spec 028, R5 : une demande d'addition n'a qu'un geste, régler son client — ni accepter, ni affecter.
  if (request.type?.kind === 'bill') {
    const due = request.bill?.dueMinor ?? 0;
    return {
      primary: handle && due > 0 ? { action: 'settle-bill', label: 'Glisser pour régler', gesture: 'slide', tone: 'ink' } : null,
      assign: false,
      transfer: false,
      release: false,
      cancel: viewer.can('requests.cancel') && request.status === 'pending',
      acknowledge: viewer.can('requests.supervise') && request.escalationStatus === 'escalated',
    };
  }
  if (request.type && isOrder(request)) {
    // Spec 025 : même circuit que l'écran « Commandes » — Accepter, puis glisser pour servir.
    const step = nextStep(request, separateKitchen, viewer);
    primary = step && { action: step.action, label: step.label, gesture: step.gesture, tone: step.tone };
  } else if (request.status === 'pending' && handle) primary = { action: 'accept', label: 'Accepter', gesture: 'tap' };
  else if (request.status === 'assigned' && handle && mine) primary = { action: 'accept', label: 'Accepter', gesture: 'tap' };
  else if (request.status === 'accepted' && own) primary = { action: 'start', label: 'Commencer', gesture: 'tap' };
  else if (request.status === 'in_progress' && own) primary = { action: 'resolve', label: 'Terminer', gesture: 'tap' };
  // Spec 007 : une commande prête est servie par n'importe quel membre qui traite les demandes.
  else if (request.status === 'ready' && handle) primary = { action: 'resolve', label: 'Servie', gesture: 'tap' };
  return {
    primary,
    assign: supervise && ['pending', 'assigned', 'in_progress'].includes(request.status),
    transfer: request.status === 'in_progress' && handle && mine && !supervise,
    release: request.status === 'assigned' && own,
    cancel: viewer.can('requests.cancel') && ['pending', 'accepted'].includes(request.status),
    acknowledge: viewer.can('requests.supervise') && request.escalationStatus === 'escalated',
  };
}
