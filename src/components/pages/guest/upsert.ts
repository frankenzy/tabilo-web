import type { GuestRequest } from '@/contracts';

/** Insère ou remplace une demande dans la liste suivie par le client. */
export function upsert(list: GuestRequest[], request: GuestRequest): GuestRequest[] {
  const exists = list.some((item) => item.id === request.id);
  return exists ? list.map((item) => (item.id === request.id ? request : item)) : [request, ...list];
}
