import type { Metadata } from 'next';
import { FloorPage } from '@/components/pages/floor/floor-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Salle' };

export default function Page() {
  return (
    <PermissionGate anyOf={['floor.read']}>
      <FloorPage />
    </PermissionGate>
  );
}
