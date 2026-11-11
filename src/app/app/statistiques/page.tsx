import type { Metadata } from 'next';
import { AnalyticsPage } from '@/components/pages/analytics/analytics-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Statistiques' };

export default function Page() {
  return (
    <PermissionGate anyOf={['analytics.read']}>
      <AnalyticsPage />
    </PermissionGate>
  );
}
