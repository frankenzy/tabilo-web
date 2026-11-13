'use client';

import { useSyncExternalStore } from 'react';

/** Spec 019, section 5 : à partir de 1 024 px, la carte et la commande s'affichent côte à côte. */
export const LANDSCAPE_QUERY = '(min-width: 1024px)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(LANDSCAPE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * Vrai sur tablette à l'horizontale (deux volets).
 * Le format suit la largeur de la fenêtre : pivoter la tablette bascule sans recharger (R7).
 */
export function useLandscape(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(LANDSCAPE_QUERY).matches,
    () => false,
  );
}
