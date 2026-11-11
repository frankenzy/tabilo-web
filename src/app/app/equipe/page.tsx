import type { Metadata } from 'next';
import { TeamPage } from '@/components/pages/team/team-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Équipe' };

export default function Page() {
  return (
    <PermissionGate anyOf={['staff.manage']}>
      <TeamPage />
    </PermissionGate>
  );
}
