import type { Metadata } from 'next';
import { OrdersPage } from '@/components/pages/orders/orders-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Commandes' };

/** Spec 007, R1 : pour tous ceux qui traitent les demandes (serveur, gérant, propriétaire). */
export default function Page() {
  return (
    <PermissionGate anyOf={['requests.handle']}>
      <OrdersPage />
    </PermissionGate>
  );
}
