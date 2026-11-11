import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/contracts';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3090').replace(/\/$/, '');
export const API_BASE = `${API_URL}/api/v1`;

/** Erreur normalisée : tout appelant reçoit un message lisible et un code stable. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  /** Erreur réseau : serveur injoignable, coupure, délai dépassé. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (axios.isAxiosError(error)) {
    const response = (error as AxiosError<Partial<ApiError>>).response;
    if (!response) {
      return new HttpError(0, 'NETWORK_ERROR', 'Connexion au serveur impossible. Vérifiez votre réseau.');
    }
    const body = response.data ?? {};
    return new HttpError(
      response.status,
      body.code ?? 'ERROR',
      body.message ?? 'Une erreur est survenue.',
      body.details,
    );
  }
  return new HttpError(0, 'UNKNOWN', 'Une erreur inattendue est survenue.');
}

/** Message à afficher à l'utilisateur pour n'importe quelle erreur. */
export function errorMessage(error: unknown): string {
  return toHttpError(error).message;
}

export interface ClientOptions {
  /** Envoie le cookie de rafraîchissement (routes /auth uniquement). */
  withCredentials?: boolean;
  onRequest?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;
  /** Tentative de reprise sur 401 : renvoie true si la requête peut être rejouée. */
  onUnauthorized?: () => Promise<boolean>;
}

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean };

export function createClient(options: ClientOptions = {}): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE,
    timeout: 15_000,
    withCredentials: options.withCredentials ?? false,
    headers: { 'Content-Type': 'application/json' },
  });
  if (options.onRequest) client.interceptors.request.use(options.onRequest);
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as Retriable | undefined;
      if (error.response?.status === 401 && config && !config._retried && options.onUnauthorized) {
        config._retried = true;
        if (await options.onUnauthorized()) return client.request(config);
      }
      throw toHttpError(error);
    },
  );
  return client;
}
