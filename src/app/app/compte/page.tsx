import type { Metadata } from 'next';
import { AccountPage } from '@/components/pages/account/account-page';

export const metadata: Metadata = { title: 'Mon compte' };

export default function Page() {
  return <AccountPage />;
}
