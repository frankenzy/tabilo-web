import { getAccessToken, httpAuth, refreshAccessToken } from '@/services/auth/auth-token';
import { createClient } from './axios.client';

export { API_BASE, API_URL, REALTIME_URL, errorMessage, HttpError, toHttpError } from './axios.client';

/**
 * Point d'entrée unique des appels API.
 *  - `http`      : espace personnel — jeton Bearer, reprise automatique après rafraîchissement ;
 *  - `httpAuth`  : routes /auth — seul client à envoyer le cookie de rafraîchissement ;
 *  - `httpGuest` : parcours client — aucune identité du personnel, jeton de session de table ;
 *  - `httpPlatform` : console de la plateforme (spec 036), cookie de session.
 */
export const http = createClient({
  onRequest: (config) => {
    const token = getAccessToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  },
  onUnauthorized: refreshAccessToken,
});

export const httpGuest = createClient();

/** Spec 036 : console de la plateforme — session en cookie HttpOnly, jamais de jeton côté navigateur. */
export const httpPlatform = createClient({ withCredentials: true });

export { httpAuth };
