import type { Metadata } from 'next';
import { GuestPage } from '@/components/pages/guest/guest-page';
import { prefetchScript } from '@/components/pages/guest/session-prefetch';

export const metadata: Metadata = {
  title: 'Votre table',
  robots: { index: false, follow: false },
};

export default async function TablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // La session part avec le HTML, sans attendre le JavaScript de la page (voir session-prefetch.ts).
  const script = prefetchScript(code, process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3090');
  return (
    <>
      {script && <script dangerouslySetInnerHTML={{ __html: script }} />}
      <GuestPage code={code} />
    </>
  );
}
