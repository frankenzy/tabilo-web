import localFont from 'next/font/local';

/**
 * Geist Mono, même fichier et mêmes réglages que `geist/font/mono`, mais sans préchargement.
 * Elle ne sert qu'aux numéros de table et aux chronos de l'espace pro : préchargée sur toutes les pages,
 * elle faisait télécharger 68 kB de plus à la page client, sur le chemin critique d'un téléphone en 4G.
 * Là où elle est utilisée, le navigateur la télécharge à la première utilisation (font-display: swap).
 */
export const geistMono = localFont({
  src: '../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2',
  variable: '--font-geist-mono',
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Roboto Mono', 'Menlo', 'Monaco', 'Liberation Mono', 'DejaVu Sans Mono', 'Courier New', 'monospace'],
  weight: '100 900',
});
