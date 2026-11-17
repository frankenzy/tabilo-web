import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import { geistMono } from './fonts';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'TABILO', template: '%s · TABILO' },
  description: 'Gestion et supervision des demandes de service en salle.',
  applicationName: 'TABILO',
  appleWebApp: { capable: true, title: 'TABILO', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#f7f5f1',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
