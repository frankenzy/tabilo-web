import type { GuestRequest, GuestRequestType } from '@/contracts';

/** Identifiant de l'appel affiché avant la réponse du serveur. */
export const OPTIMISTIC_CALL = 'appel-en-cours';

/** Spec 029, R1 : l'appel et le message de l'établissement, reconnus par leur genre. */
export function serverTypes(types: GuestRequestType[]): { call?: GuestRequestType; message?: GuestRequestType } {
  // Session ouverte avant la mise à jour, ou API pas encore migrée : le genre manque, le pictogramme suffit.
  const byIcon = (icon: string) => types.find((type) => type.kind === 'service' && type.icon === icon);
  return {
    call: types.find((type) => type.kind === 'call') ?? byIcon('bell'),
    message: types.find((type) => type.kind === 'message') ?? byIcon('message-circle'),
  };
}

/** Spec 029, R2 : ce que le bouton « Serveur » propose — l'appel et le message, rien d'autre. */
export function hasServerButton(types: GuestRequestType[]): boolean {
  const { call, message } = serverTypes(types);
  return call !== undefined || message !== undefined;
}

/** Spec 029, R4 : appel et message vivent dans leur propre carte, pas dans la frise des demandes. */
export function isServerRequest(request: Pick<GuestRequest, 'type'>): boolean {
  return request.type.kind === 'call' || request.type.kind === 'message';
}

