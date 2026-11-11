'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Spinner } from '@/components/ui';
import { restoreSession } from '@/services/auth/session';
import { onAccessTokenChange } from '@/services/auth/auth-token';
import { useAuthStore } from '@/stores/auth.store';

const ACCOUNT_PATH = '/app/compte';

/**
 * Protège l'espace personnel côté interface : sans session, retour à la connexion.
 * La protection réelle des données est faite par l'API (jeton, périmètre, permissions).
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const me = useAuthStore((state) => state.me);
  const establishmentId = useAuthStore((state) => state.establishmentId);

  useEffect(() => {
    if (status === 'loading') void restoreSession();
  }, [status]);

  // Session perdue en cours d'utilisation (rafraîchissement refusé, compte désactivé).
  useEffect(
    () =>
      onAccessTokenChange((token) => {
        if (!token) useAuthStore.getState().clear();
      }),
    [],
  );

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === 'authenticated' && me?.mustChangePassword && pathname !== ACCOUNT_PATH) {
      router.replace(ACCOUNT_PATH);
    }
  }, [status, me, pathname, router]);

  if (status !== 'authenticated' || !me) return <Spinner className="min-h-dvh" label="Ouverture de votre espace…" />;
  if (!establishmentId) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center text-sm text-ink-2">
        Votre compte n’est rattaché à aucun établissement. Contactez votre gérant.
      </div>
    );
  }
  if (me.mustChangePassword && pathname !== ACCOUNT_PATH) return <Spinner className="min-h-dvh" />;
  return <>{children}</>;
}
