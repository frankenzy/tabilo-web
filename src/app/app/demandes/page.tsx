import type { Metadata } from 'next';
import { HistoryPage } from '@/components/pages/history/history-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Historique' };

export default function Page() {
  return (
    <PermissionGate anyOf={['requests.read']}>
      <HistoryPage />
    </PermissionGate>
  );
}
