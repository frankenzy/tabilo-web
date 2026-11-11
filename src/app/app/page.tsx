'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { visibleNav } from '@/components/layouts/navigation';
import { Spinner } from '@/components/ui';
import { useMembership } from '@/stores/auth.store';

/** Entrée de l'espace : premier écran autorisé pour le rôle (service pour un serveur). */
export default function AppIndex() {
  const router = useRouter();
  const membership = useMembership();
  useEffect(() => {
    const first = visibleNav(membership?.permissions ?? [])[0];
    router.replace(first?.href ?? '/app/compte');
  }, [membership, router]);
  return <Spinner />;
}
