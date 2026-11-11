import { create } from 'zustand';
import type { Me } from '@/contracts';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
const STORAGE_KEY = 'tabilo.establishment';

interface AuthState {
  status: AuthStatus;
  me: Me | null;
  establishmentId: string | null;
  setSession: (me: Me) => void;
  clear: () => void;
  selectEstablishment: (id: string) => void;
}

function rememberedEstablishment(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  me: null,
  establishmentId: null,
  setSession: (me) => {
    const remembered = get().establishmentId ?? rememberedEstablishment();
    const allowed = me.memberships.map((m) => m.establishment.id);
    const establishmentId = remembered && allowed.includes(remembered) ? remembered : (allowed[0] ?? null);
    set({ status: 'authenticated', me, establishmentId });
  },
  clear: () => set({ status: 'anonymous', me: null, establishmentId: null }),
  selectEstablishment: (id) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // stockage indisponible : le choix vaut pour la session en cours
    }
    set({ establishmentId: id });
  },
}));

/** Adhésion active : établissement courant, rôle et permissions. */
export function useMembership() {
  return useAuthStore((state) => state.me?.memberships.find((m) => m.establishment.id === state.establishmentId) ?? null);
}

/**
 * Masque les actions non autorisées. Confort d'interface uniquement :
 * chaque permission est vérifiée par l'API.
 */
export function useCan(permission: string): boolean {
  return useMembership()?.permissions.includes(permission) ?? false;
}
