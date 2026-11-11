import { create } from 'zustand';

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

/** État de la liaison temps réel, affiché à l'utilisateur et utilisé pour activer le repli HTTP. */
export const useRealtimeStore = create<{ status: RealtimeStatus; set: (status: RealtimeStatus) => void }>((set) => ({
  status: 'connecting',
  set: (status) => set({ status }),
}));
