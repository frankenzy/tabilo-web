'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MenuCategory, MenuItem } from '@/contracts';

/** Quantités par article. Plafond par ligne aligné sur l'API (1 à 20). */
export type Cart = Record<string, number>;
export const MAX_QUANTITY = 20;
export const MAX_LINES = 30;

const storageKey = (token: string) => `tabilo.cart.${token}`;

function read(token: string): Cart {
  try {
    const raw = window.sessionStorage.getItem(storageKey(token));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, number] => Number.isInteger(entry[1]) && (entry[1] as number) > 0,
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Panier de la session de table, conservé dans l'onglet (sessionStorage) :
 * il survit à un rechargement de page, pas à la fermeture de l'onglet (spec 001, CA-001-16).
 */
export function useCart(token: string) {
  const [cart, setCart] = useState<Cart>({});

  useEffect(() => setCart(read(token)), [token]);

  const update = useCallback(
    (change: (current: Cart) => Cart) =>
      setCart((current) => {
        const next = change(current);
        try {
          window.sessionStorage.setItem(storageKey(token), JSON.stringify(next));
        } catch {
          // stockage indisponible : le panier vit le temps de la page
        }
        return next;
      }),
    [token],
  );

  const setQuantity = useCallback(
    (itemId: string, quantity: number) =>
      update((current) => {
        const next = { ...current };
        if (quantity <= 0) delete next[itemId];
        else if (next[itemId] !== undefined || Object.keys(next).length < MAX_LINES) next[itemId] = Math.min(quantity, MAX_QUANTITY);
        return next;
      }),
    [update],
  );

  const clear = useCallback(() => update(() => ({})), [update]);

  return { cart, setQuantity, clear };
}

export interface CartLine {
  itemId: string;
  quantity: number;
  item: MenuItem | null;
  /** L'article a disparu de la carte ou est en rupture : la commande serait refusée. */
  invalid: boolean;
}

/** Rapproche le panier de la carte actuelle : prix à jour, lignes devenues impossibles signalées. */
export function cartLines(cart: Cart, menu: MenuCategory[]): { lines: CartLine[]; count: number; totalMinor: number; hasInvalid: boolean } {
  const items = new Map(menu.flatMap((category) => category.items).map((item) => [item.id, item]));
  const lines = Object.entries(cart).map(([itemId, quantity]) => {
    const item = items.get(itemId) ?? null;
    return { itemId, quantity, item, invalid: !item || !item.isAvailable };
  });
  const valid = lines.filter((line) => !line.invalid);
  return {
    lines,
    count: valid.reduce((sum, line) => sum + line.quantity, 0),
    totalMinor: valid.reduce((sum, line) => sum + line.quantity * (line.item?.priceMinor ?? 0), 0),
    hasInvalid: lines.some((line) => line.invalid),
  };
}
