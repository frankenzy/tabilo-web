'use client';

import { use } from 'react';
import { TenantPage } from '@/components/pages/platform/tenant-page';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TenantPage id={id} />;
}
