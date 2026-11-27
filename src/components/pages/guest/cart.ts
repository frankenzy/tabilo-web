'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MenuCategory, MenuItem } from '@/contracts';
import { isOpen } from '@/utils/slots';

/**
 * Quantités par ligne. Plafond par ligne aligné sur l'API (1 à 20).
 * Clé : l'identifiant du plat ; pour une formule (spec 032), `formule~plat1.plat2` — une ligne par composition.
 */
export type Cart = Record<string, number>;

const BUNDLE_SEPARATOR = '~';

/** Spec 032 : clé d'une composition de formule, un plat par rubrique dans l'ordre des rubriques. */
export function bundleKey(bundleId: string, choiceIds: string[]): string {
  return `${bundleId}${BUNDLE_SEPARATOR}${choiceIds.join('.')}`;
}

/** Spec 038 : clé d'un plat avec ses options (triées : l'ordre de toucher ne crée pas deux lignes). */
export function optionKey(itemId: string, optionIds: string[]): string {
  return optionIds.length === 0 ? itemId : `${itemId}+${[...optionIds].sort().join('.')}`;
}

export function parseCartKey(key: string): { itemId: string; choiceIds: string[]; optionIds: string[] } {
  const [base, options] = key.split('+');
  const [itemId, choices] = base.split(BUNDLE_SEPARATOR);
  return { itemId, choiceIds: choices ? choices.split('.') : [], optionIds: options ? options.split('.') : [] };
}

/** Quantité d'un plat ou d'une formule dans le panier, toutes compositions confondues. */
export function quantityOf(cart: Cart, itemId: string): number {
  return Object.entries(cart).reduce((sum, [key, quantity]) => (parseCartKey(key).itemId === itemId ? sum + quantity : sum), 0);
}
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

/** Précisions pour la cuisine (spec 013, R2) : pastilles choisies et texte libre. */
export interface OrderDetails {
  precisions: string[];
  note: string;
}
const EMPTY_DETAILS: OrderDetails = { precisions: [], note: '' };
const detailsKey = (token: string) => `tabilo.order-details.${token}`;

function readDetails(token: string): OrderDetails {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(detailsKey(token)) ?? 'null') as Partial<OrderDetails> | null;
    return {
      precisions: Array.isArray(parsed?.precisions) ? parsed.precisions.filter((key): key is string => typeof key === 'string') : [],
      note: typeof parsed?.note === 'string' ? parsed.note : '',
    };
  } catch {
    return EMPTY_DETAILS;
  }
}

/**
 * Les précisions vivent avec le panier, pas dans la feuille « Votre commande » : revenir à la carte
 * pour ajouter un plat, fermer la feuille ou recharger la page ne les efface plus.
 */
export function useOrderDetails(token: string) {
  const [details, setDetails] = useState<OrderDetails>(EMPTY_DETAILS);

  useEffect(() => setDetails(readDetails(token)), [token]);

  const update = useCallback(
    (change: (current: OrderDetails) => OrderDetails) =>
      setDetails((current) => {
        const next = change(current);
        try {
          window.sessionStorage.setItem(detailsKey(token), JSON.stringify(next));
        } catch {
          // stockage indisponible : les précisions vivent le temps de la page
        }
        return next;
      }),
    [token],
  );

  const clearDetails = useCallback(() => update(() => EMPTY_DETAILS), [update]);

  return { details, updateDetails: update, clearDetails };
}

export interface CartLine {
  /** Clé de la ligne dans le panier (sert à changer sa quantité). */
  itemId: string;
  /** Le plat ou la formule commandé. */
  menuItemId: string;
  quantity: number;
  item: MenuItem | null;
  /** Spec 032 : plats choisis, un par rubrique de la formule ; vide pour un plat. */
  choices: { groupId: string; group: string; item: MenuItem | null }[];
  /** Spec 038 : options choisies. */
  options: { id: string; group: string; name: string; priceMinor: number }[];
  /** Prix d'une unité : prix du moment (promotion, spec 033 et 039) plus les suppléments (spec 038, R3). */
  unitMinor: number;
  /** L'article a disparu de la carte ou est en rupture : la commande serait refusée. */
  invalid: boolean;
}

/** Spec 033, R1 et spec 039, R2 : la promotion s'applique (dans son créneau, s'il y en a). */
export function promoActive(item: Pick<MenuItem, 'priceMinor' | 'promoPriceMinor'> & Partial<Pick<MenuItem, 'promoSlots'>>, now = new Date(), timeZone = 'Africa/Abidjan'): boolean {
  return item.promoPriceMinor !== null && item.promoPriceMinor < item.priceMinor && isOpen(item.promoSlots, now, timeZone);
}

/** Spec 033, R1 : le prix commandé — le prix promo s'il s'applique. */
export function unitPrice(item: Pick<MenuItem, 'priceMinor' | 'promoPriceMinor'> & Partial<Pick<MenuItem, 'promoSlots'>>, now = new Date(), timeZone = 'Africa/Abidjan'): number {
  return promoActive(item, now, timeZone) ? item.promoPriceMinor! : item.priceMinor;
}

/** Spec 039, R3 : disponible maintenant (rupture et créneaux). */
export function orderableNow(item: Pick<MenuItem, 'isAvailable'> & Partial<Pick<MenuItem, 'availabilitySlots'>>, now = new Date(), timeZone = 'Africa/Abidjan'): boolean {
  return item.isAvailable && isOpen(item.availabilitySlots, now, timeZone);
}

/** Spec 038, R2 : les options choisies respectent chaque groupe. */
export function optionsValid(item: Pick<MenuItem, 'optionGroups'>, optionIds: string[]): boolean {
  const wanted = new Set(optionIds);
  const known = new Set(item.optionGroups.flatMap((group) => group.options.map((option) => option.id)));
  if ([...wanted].some((id) => !known.has(id))) return false;
  return item.optionGroups.every((group) => {
    const picked = group.options.filter((option) => wanted.has(option.id));
    return (!group.required || picked.length > 0) && (group.multiple || picked.length <= 1) && picked.every((option) => option.isAvailable);
  });
}

/** Rapproche le panier de la carte actuelle : prix à jour, lignes devenues impossibles signalées. */
export function cartLines(
  cart: Cart,
  menu: MenuCategory[],
  now = new Date(),
  timeZone = 'Africa/Abidjan',
): { lines: CartLine[]; count: number; totalMinor: number; hasInvalid: boolean } {
  const items = new Map(menu.flatMap((category) => category.items).map((item) => [item.id, item]));
  const lines = Object.entries(cart).map(([key, quantity]): CartLine => {
    const { itemId, choiceIds, optionIds } = parseCartKey(key);
    const item = items.get(itemId) ?? null;
    const groups = item?.isBundle ? item.groups : [];
    const choices = groups.map((group, index) => ({ groupId: group.id, group: group.name, item: items.get(choiceIds[index]) ?? null }));
    // Spec 032, R2 et R4 : chaque rubrique a son plat, encore proposé et disponible.
    const badChoice =
      (item?.isBundle ?? false) &&
      (choiceIds.length !== groups.length || choices.some((choice, index) => !choice.item?.isAvailable || !groups[index].choiceIds.includes(choiceIds[index])));
    const options = (item?.optionGroups ?? []).flatMap((group) =>
      group.options.filter((option) => optionIds.includes(option.id)).map((option) => ({ id: option.id, group: group.name, name: option.name, priceMinor: option.priceMinor })),
    );
    const unitMinor = item ? unitPrice(item, now, timeZone) + options.reduce((sum, option) => sum + option.priceMinor, 0) : 0;
    const badOptions = item !== null && !optionsValid(item, optionIds);
    return {
      itemId: key, menuItemId: itemId, quantity, item, choices, options, unitMinor,
      invalid: !item || !orderableNow(item, now, timeZone) || badChoice || badOptions,
    };
  });
  const valid = lines.filter((line) => !line.invalid);
  return {
    lines,
    count: valid.reduce((sum, line) => sum + line.quantity, 0),
    totalMinor: valid.reduce((sum, line) => sum + line.quantity * line.unitMinor, 0),
    hasInvalid: lines.some((line) => line.invalid),
  };
}
