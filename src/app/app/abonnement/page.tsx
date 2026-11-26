import type { Metadata } from 'next';
import { SubscriptionPage } from '@/components/pages/subscription/subscription-page';

export const metadata: Metadata = { title: 'Abonnement' };

export default function Page() {
  return <SubscriptionPage />;
}
