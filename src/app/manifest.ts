import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TABILO',
    short_name: 'TABILO',
    description: 'Demandes de service en salle',
    start_url: '/app',
    display: 'standalone',
    background_color: '#f7f5f1',
    theme_color: '#f7f5f1',
    lang: 'fr',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
