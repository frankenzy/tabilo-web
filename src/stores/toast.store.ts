import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'alert';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { ...toast, id }] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), toast.tone === 'error' ? 7000 : 4500);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Raccourcis utilisables hors des composants (mutations, intercepteurs). */
export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().push({ tone: 'success', title, description }),
  error: (title: string, description?: string) => useToastStore.getState().push({ tone: 'error', title, description }),
  info: (title: string, description?: string) => useToastStore.getState().push({ tone: 'info', title, description }),
  alert: (title: string, description?: string) => useToastStore.getState().push({ tone: 'alert', title, description }),
};
