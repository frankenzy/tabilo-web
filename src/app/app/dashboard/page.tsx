import type { Metadata } from 'next';
import { DashboardPage } from '@/components/pages/dashboard/dashboard-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default function Page() {
  return (
    <PermissionGate anyOf={['analytics.read']}>
      <DashboardPage />
    </PermissionGate>
  );
}
