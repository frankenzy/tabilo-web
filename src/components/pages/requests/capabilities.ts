import type { ServiceRequest } from '@/contracts';
import type { RequestAction } from '@/services/api';

export interface Viewer {
  id: string;
  can: (permission: string) => boolean;
}

interface Capabilities {
  primary: { action: RequestAction; label: string } | null;
  assign: boolean;
  transfer: boolean;
  release: boolean;
  cancel: boolean;
  acknowledge: boolean;
}

/** Ce que l'utilisateur peut proposer sur une demande. Reflète les règles de l'API, qui reste seule juge. */
export function capabilitiesOf(request: ServiceRequest, viewer: Viewer): Capabilities {
  const mine = request.assignee?.id === viewer.id;
  const handle = viewer.can('requests.handle');
  const supervise = viewer.can('requests.assign');
  const own = handle && (mine || supervise);
  let primary: Capabilities['primary'] = null;
  if (request.status === 'pending' && handle) primary = { action: 'accept', label: 'Accepter' };
  else if (request.status === 'assigned' && handle && mine) primary = { action: 'accept', label: 'Accepter' };
  else if (request.status === 'accepted' && own) primary = { action: 'start', label: 'Commencer' };
  else if (request.status === 'in_progress' && own) primary = { action: 'resolve', label: 'Terminer' };
  return {
    primary,
    assign: supervise && ['pending', 'assigned', 'in_progress'].includes(request.status),
    transfer: request.status === 'in_progress' && handle && mine && !supervise,
    release: request.status === 'assigned' && own,
    cancel: viewer.can('requests.cancel') && ['pending', 'accepted'].includes(request.status),
    acknowledge: viewer.can('requests.supervise') && request.escalationStatus === 'escalated',
  };
}
