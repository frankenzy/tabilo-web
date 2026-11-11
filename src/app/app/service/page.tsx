import type { Metadata } from 'next';
import { ServicePage } from '@/components/pages/service/service-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Service' };

export default function Page() {
  return (
    <PermissionGate anyOf={['requests.read']}>
      <ServicePage />
    </PermissionGate>
  );
}
