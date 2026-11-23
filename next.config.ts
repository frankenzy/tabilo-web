import type { NextConfig } from 'next';

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3090';
// Temps réel : par défaut sur l'API ; distinct quand l'API passe par le proxy ci-dessous.
const realtimeOrigin = (process.env.NEXT_PUBLIC_REALTIME_URL || apiOrigin).replace(/\/$/, '');
const wsOrigin = realtimeOrigin.replace(/^http/, 'ws');
// Hébergement Vercel + Render : `/api/*` est relayé vers l'API, qui devient du même site que la page.
// Le cookie de rafraîchissement (SameSite=Strict) est alors envoyé ; sinon *.vercel.app et *.onrender.com
// sont deux sites distincts et la session tombe à l'expiration du jeton d'accès.
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, '');
const isDev = process.env.NODE_ENV !== 'production';
// En développement, la page peut être ouverte depuis un téléphone du réseau local (http://192.168.x.x:3004) :
// l'API est alors jointe sur la même adresse, port 3090 (voir services/http/axios.client.ts).
const devApi = isDev ? ' http://*:3090 ws://*:3090' : '';

// Politique de sécurité du contenu : scripts et styles de l'application uniquement,
// connexions limitées à l'API TABILO. `unsafe-eval` n'est toléré qu'en développement (HMR).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Photos de la carte servies par l'API (spec 001/002).
  `img-src 'self' data: blob: ${apiOrigin}${isDev ? ' http://*:3090' : ''}`,
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin} ${realtimeOrigin} ${wsOrigin}${devApi}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Développement : le badge « N » de Next.js recouvrait les boutons du bas de l'écran client (fiche d'un plat).
  // Les erreurs restent affichées en surimpression.
  devIndicators: false,
  // Développement : autorise l'ouverture des pages depuis 127.0.0.1 ou un appareil du réseau local.
  allowedDevOrigins: ['127.0.0.1', '192.168.*.*', '10.*.*.*', '172.*.*.*'],
  // Sortie autonome pour l'image Docker uniquement ; `next start` sert le build en local.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  // Les erreurs de types et de lint bloquent le build : pas de ignoreBuildErrors.
  async rewrites() {
    return apiProxyTarget ? [{ source: '/api/:path*', destination: `${apiProxyTarget}/api/:path*` }] : [];
  },
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
