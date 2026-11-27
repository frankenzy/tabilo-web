'use client';

import type { ReactNode } from 'react';
import { PlatformShell } from '@/components/pages/platform/platform-shell';

/** Spec 036 : console de la plateforme, sous /plateforme (Q1). */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
