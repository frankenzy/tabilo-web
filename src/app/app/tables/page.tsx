import type { Metadata } from 'next';
import { TablesPage } from '@/components/pages/tables/tables-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Tables' };

/** Spec 006, R1 : réservée au gérant et au propriétaire (seuls rôles qui détiennent analytics.read). */
export default function Page() {
  return (
    <PermissionGate anyOf={['analytics.read']}>
      <TablesPage />
    </PermissionGate>
  );
}
