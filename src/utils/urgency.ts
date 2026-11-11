import type { ServiceRequest } from '@/contracts';

/**
 * Niveau d'urgence d'une demande, calculé à partir de données réelles :
 *  - calm     : dans la première moitié du délai cible ;
 *  - waiting  : seconde moitié du délai cible ;
 *  - late     : délai cible dépassé sans prise en charge ;
 *  - progress : prise en charge (acceptée ou en cours) ;
 *  - done     : terminée.
 * Une demande escaladée et non acquittée reste signalée, quel que soit son niveau.
 */
export type Urgency = 'calm' | 'waiting' | 'late' | 'progress' | 'done';

export function urgencyOf(request: Pick<ServiceRequest, 'status' | 'createdAt' | 'dueAt'>, now: number): Urgency {
  if (request.status === 'resolved' || request.status === 'cancelled') return 'done';
  if (request.status === 'accepted' || request.status === 'in_progress') return 'progress';
  const created = new Date(request.createdAt).getTime();
  const due = new Date(request.dueAt).getTime();
  if (now >= due) return 'late';
  return now - created >= (due - created) / 2 ? 'waiting' : 'calm';
}

const RANK: Record<Urgency, number> = { late: 4, waiting: 3, calm: 2, progress: 1, done: 0 };

/** La plus urgente d'une liste (pour colorer une table). */
export function worstUrgency(levels: Urgency[]): Urgency | null {
  if (levels.length === 0) return null;
  return levels.reduce((worst, level) => (RANK[level] > RANK[worst] ? level : worst));
}

export const URGENCY_TILE: Record<Urgency, string> = {
  calm: 'bg-calm text-calm-ink',
  waiting: 'bg-wait text-wait-ink',
  late: 'bg-late text-white',
  progress: 'bg-progress-soft text-progress',
  done: 'bg-done-soft text-done',
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  calm: 'Nouvelle',
  waiting: 'En attente',
  late: 'En retard',
  progress: 'Prise en charge',
  done: 'Terminée',
};
