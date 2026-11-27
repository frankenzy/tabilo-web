'use client';

import { useLayoutEffect } from 'react';
import { brandOf, brandVariables } from '@/constants/branding';

/**
 * Spec 031, R3 et R7 : la page client prend la couleur et le nom de l'établissement avant d'être peinte.
 * Les variables vont sur la racine du document, pour que les feuilles et fenêtres (rendues hors de la page) suivent aussi.
 * Elles sont retirées en quittant la page.
 */
export function useBranding(brandColor: string, name: string): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const variables = brandVariables(brandColor);
    for (const [property, value] of Object.entries(variables)) root.style.setProperty(property, value);

    const previousTitle = document.title;
    document.title = name;
    // Barre du navigateur à la couleur de l'établissement (R3).
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = meta?.content;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = brandOf(brandColor).brand;

    return () => {
      for (const property of Object.keys(variables)) root.style.removeProperty(property);
      document.title = previousTitle;
      if (meta && previousTheme !== undefined) meta.content = previousTheme;
    };
  }, [brandColor, name]);
}
