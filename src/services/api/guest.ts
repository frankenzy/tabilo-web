import {
  guestContextSchema, guestCreateResultSchema, guestRequestListSchema, guestRequestSchema, guestSessionSchema,
  type GuestContext, type GuestRequest,
} from '@/contracts';
import { z } from 'zod';
import { httpGuest } from '@/services/http';

/** Appels du parcours client. Chaque réponse est validée : un schéma inattendu est une erreur, pas un affichage faux. */

const SESSION_HEADER = 'x-table-session';
const headers = (token: string) => ({ [SESSION_HEADER]: token });

export const guestApi = {
  async openSession(code: string) {
    const response = await httpGuest.post('/guest/sessions', { code });
    return guestSessionSchema.parse(response.data);
  },
  async context(token: string): Promise<GuestContext> {
    const response = await httpGuest.get('/guest/session', { headers: headers(token) });
    return guestContextSchema.parse(response.data);
  },
  async requests(token: string): Promise<GuestRequest[]> {
    const response = await httpGuest.get('/guest/requests', { headers: headers(token) });
    return guestRequestListSchema.parse(response.data);
  },
  async create(token: string, body: { requestTypeId: string; note?: string; quantity?: number }, idempotencyKey: string) {
    const response = await httpGuest.post('/guest/requests', body, {
      headers: { ...headers(token), 'idempotency-key': idempotencyKey },
    });
    return guestCreateResultSchema.parse(response.data);
  },
  async order(token: string, body: { items: { menuItemId: string; quantity: number }[]; note?: string }, idempotencyKey: string) {
    const response = await httpGuest.post('/guest/orders', body, {
      headers: { ...headers(token), 'idempotency-key': idempotencyKey },
    });
    return guestCreateResultSchema.parse(response.data);
  },
  async suggestions(token: string, items: string[]): Promise<string[]> {
    const response = await httpGuest.get('/guest/suggestions', { headers: headers(token), params: items.length ? { items: items.join(',') } : {} });
    return z.object({ menuItemIds: z.array(z.string()) }).parse(response.data).menuItemIds;
  },
  async cancel(token: string, id: string): Promise<GuestRequest> {
    const response = await httpGuest.post(`/guest/requests/${id}/cancel`, {}, { headers: headers(token) });
    return guestRequestSchema.parse(response.data);
  },
};

// Jeton de session : conservé sur l'appareil pour survivre à un rechargement de page.
const storageKey = (code: string) => `tabilo.table.${code}`;

export function readStoredToken(code: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(code));
  } catch {
    return null;
  }
}

export function storeToken(code: string, token: string | null): void {
  try {
    if (token) window.localStorage.setItem(storageKey(code), token);
    else window.localStorage.removeItem(storageKey(code));
  } catch {
    // stockage indisponible (navigation privée) : la session vit le temps de la page
  }
}
