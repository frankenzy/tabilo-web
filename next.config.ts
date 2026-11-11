import type { NextConfig } from 'next';

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3090';
const wsOrigin = apiOrigin.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV !== 'production';

// Politique de sécurité du contenu : scripts et styles de l'application uniquement,
// connexions limitées à l'API TABILO. `unsafe-eval` n'est toléré qu'en développement (HMR).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Photos de la carte servies par l'API (spec 001/002).
  `img-src 'self' data: blob: ${apiOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin} ${wsOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Sortie autonome pour l'image Docker uniquement ; `next start` sert le build en local.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  // Les erreurs de types et de lint bloquent le build : pas de ignoreBuildErrors.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // Le code QR figure dans l'URL : ne jamais l'envoyer en Referer.
      { source: '/t/:code', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
    ];
  },
};

export default nextConfig;
