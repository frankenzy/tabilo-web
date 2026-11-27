import type { ServiceRequest } from '@/contracts';

/** Spec 048, R2 : prioritaires d'abord (groupe épinglé), puis la plus récente d'abord dans chaque groupe. */
export function byUrgency(a: ServiceRequest, b: ServiceRequest): number {
  if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
  return b.createdAt.localeCompare(a.createdAt);
}
