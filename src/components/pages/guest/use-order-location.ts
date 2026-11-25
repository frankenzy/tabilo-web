'use client';

import { useEffect, useState } from 'react';

/** Ce que la commande transmet de la position (spec 027, R8). Les coordonnées ne sont jamais conservées. */
export type OrderLocation =
  | { location: { latitude: number; longitude: number; accuracyM: number } }
  | { locationStatus: 'denied' | 'unavailable' };

/** R8 et exigence de fiabilité : la position ne retarde jamais l'envoi de plus de 5 secondes. */
export const LOCATION_TIMEOUT_MS = 5_000;
const EXPLAINED_KEY = 'tabilo.zone.explained';

// Écran d'explication affiché avant la demande d'autorisation du navigateur : une promesse en attente,
// résolue par le bouton « Continuer » du composant monté dans la page de table.
let pending: (() => void) | null = null;
const listeners = new Set<(open: boolean) => void>();

function explain(): Promise<void> {
  return new Promise((resolve) => {
    pending = resolve;
    listeners.forEach((listener) => listener(true));
  });
}

/** « Continuer » sur l'écran d'explication. */
export function continueAfterExplanation(): void {
  pending?.();
  pending = null;
  listeners.forEach((listener) => listener(false));
}

/** L'écran d'explication est-il ouvert ? */
export function useLocationExplanation(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    listeners.add(setOpen);
    return () => {
      listeners.delete(setOpen);
    };
  }, []);
  return open;
}

function explainedOnce(): boolean {
  try {
    return localStorage.getItem(EXPLAINED_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberExplained(): void {
  try {
    localStorage.setItem(EXPLAINED_KEY, '1');
  } catch {
    /* stockage indisponible : l'explication reviendra, sans gêne */
  }
}

async function permissionState(): Promise<PermissionState | 'unknown'> {
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return 'unknown';
  }
}

/**
 * Spec 027, R8 : position du téléphone au moment de commander.
 * Refus → `denied` ; délai dépassé, erreur ou navigateur sans géolocalisation → `unavailable`.
 * La commande part dans tous les cas : ce résultat n'est qu'un signalement pour le personnel.
 */
export async function orderLocation(): Promise<OrderLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return { locationStatus: 'unavailable' };
  const state = await permissionState();
  if (state === 'denied') return { locationStatus: 'denied' };
  if (state !== 'granted' && !explainedOnce()) {
    await explain();
    rememberExplained();
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve({ locationStatus: 'unavailable' }), LOCATION_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer);
        resolve({
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyM: Math.round(position.coords.accuracy),
          },
        });
      },
      (error) => {
        window.clearTimeout(timer);
        resolve({ locationStatus: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable' });
      },
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 60_000 },
    );
  });
}
