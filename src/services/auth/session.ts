import { authApi } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { getAccessToken, refreshAccessToken } from './auth-token';

let restoring: Promise<boolean> | null = null;

/**
 * Restaure la session au chargement : le jeton d'accès n'étant qu'en mémoire, on en redemande
 * un grâce au cookie de rafraîchissement, puis on charge le profil et les permissions.
 */
export function restoreSession(): Promise<boolean> {
  restoring ??= (async () => {
    try {
      if (!getAccessToken() && !(await refreshAccessToken())) {
        useAuthStore.getState().clear();
        return false;
      }
      useAuthStore.getState().setSession(await authApi.me());
      return true;
    } catch {
      useAuthStore.getState().clear();
      return false;
    }
  })().finally(() => {
    restoring = null;
  });
  return restoring;
}

export async function signOut(): Promise<void> {
  await authApi.logout().catch(() => undefined);
  useAuthStore.getState().clear();
}
