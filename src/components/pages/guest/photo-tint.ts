'use client';

import { useEffect, useState } from 'react';

/**
 * Spec 012, R8 : couleur dominante d'une photo de plat, pour teinter légèrement la fiche.
 * La photo est réduite à 24 × 24 points ; on fait la moyenne en privilégiant les couleurs vives
 * (un fond de table gris ou blanc ne doit pas l'emporter sur la sauce ou les légumes).
 * Résultat mémorisé par photo. En cas d'échec (photo absente, refusée), pas de teinte.
 */
const cache = new Map<string, string | null>();

export function dominantColor(pixels: Uint8ClampedArray): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue; // transparent
    const red = pixels[i];
    const green = pixels[i + 1];
    const blue = pixels[i + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const lightness = (max + min) / 510;
    // Couleurs vives et ni trop sombres ni trop claires : elles pèsent davantage.
    const w = 0.15 + saturation * saturation * (1 - Math.abs(lightness - 0.5) * 1.4);
    if (w <= 0) continue;
    r += red * w;
    g += green * w;
    b += blue * w;
    weight += w;
  }
  if (weight === 0) return null;
  return `rgb(${Math.round(r / weight)} ${Math.round(g / weight)} ${Math.round(b / weight)})`;
}

export function usePhotoTint(src: string | null): string | null {
  const [tint, setTint] = useState<string | null>(() => (src ? (cache.get(src) ?? null) : null));
  useEffect(() => {
    if (!src) return setTint(null);
    if (cache.has(src)) return setTint(cache.get(src) ?? null);
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous'; // lecture des pixels : la photo vient de l'API (autre port)
    image.decoding = 'async';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('canvas');
        ctx.drawImage(image, 0, 0, 24, 24);
        const color = dominantColor(ctx.getImageData(0, 0, 24, 24).data);
        cache.set(src, color);
        if (!cancelled) setTint(color);
      } catch {
        cache.set(src, null);
      }
    };
    image.onerror = () => cache.set(src, null);
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return tint;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
