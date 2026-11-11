import type { Metadata } from 'next';
import { AuditPage } from '@/components/pages/audit/audit-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Journal' };

export default function Page() {
  return (
    <PermissionGate anyOf={['audit.read']}>
      <AuditPage />
    </PermissionGate>
  );
}
