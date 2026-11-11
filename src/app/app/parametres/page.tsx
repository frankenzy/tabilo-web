import type { Metadata } from 'next';
import { SettingsPage } from '@/components/pages/settings/settings-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Paramètres' };

export default function Page() {
  return (
    <PermissionGate anyOf={['establishment.update', 'request_types.manage', 'escalation.manage']}>
      <SettingsPage />
    </PermissionGate>
  );
}
