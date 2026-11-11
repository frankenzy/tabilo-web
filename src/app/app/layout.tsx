'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layouts/app-shell';
import { AuthGuard } from '@/guards/AuthGuard';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
