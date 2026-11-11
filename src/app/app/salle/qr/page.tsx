import type { Metadata } from 'next';
import { QrSheetPage } from '@/components/pages/floor/qr-sheet-page';
import { PermissionGate } from '@/guards/PermissionGate';

export const metadata: Metadata = { title: 'QR codes' };

export default function Page() {
  return (
    <PermissionGate anyOf={['qr.manage']}>
      <QrSheetPage />
    </PermissionGate>
  );
}
