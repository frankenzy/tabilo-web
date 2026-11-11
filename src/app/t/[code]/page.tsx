import type { Metadata } from 'next';
import { GuestPage } from '@/components/pages/guest/guest-page';

export const metadata: Metadata = {
  title: 'Votre table',
  robots: { index: false, follow: false },
};

export default async function TablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <GuestPage code={code} />;
}
