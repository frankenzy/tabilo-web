'use client';

import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui';
import { useMembership } from '@/stores/auth.store';

/** Évite d'afficher un écran dont toutes les requêtes seraient refusées (403) par l'API. */
export function PermissionGate({ anyOf, children }: { anyOf: string[]; children: ReactNode }) {
  const permissions = useMembership()?.permissions ?? [];
  if (!anyOf.some((permission) => permissions.includes(permission))) {
    return (
      <EmptyState
        icon={<ShieldAlert className="size-6" aria-hidden />}
        title="Accès réservé"
        description="Votre rôle ne donne pas accès à cet écran. Adressez-vous à votre gérant."
      />
    );
  }
  return <>{children}</>;
}
