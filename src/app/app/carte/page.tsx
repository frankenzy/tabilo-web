import type { Metadata } from 'next';
import { MenuPage } from '@/components/pages/menu/menu-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'Carte' };

export default function Page() {
  return (
    <PermissionGate anyOf={['requests.read']}>
      <MenuPage />
    </PermissionGate>
  );
}
