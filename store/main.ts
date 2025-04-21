import { create } from "zustand";

interface StoreState {
  roomId: string | null;
  pc: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  file: File | null;
}

interface StoreActions {
  setPc: (pc: RTCPeerConnection) => void;
  setDataChannel: (dc: RTCDataChannel | null) => void;
  setFile: (file: File) => void;
  setConnection: (params: {
    pc: RTCPeerConnection;
    dataChannel: RTCDataChannel | null;
    roomId: string;
  }) => void;
}

export type Store = StoreState & StoreActions;

export const useStore = create<Store>((set) => ({
  roomId: null,
  pc: null,
  dataChannel: null,
  file: null,
  setPc: (pc: RTCPeerConnection) => set({ pc }),
  setDataChannel: (dc: RTCDataChannel | null) => set({ dataChannel: dc }),
  setFile: (file: File) => set({ file }),
  setConnection: ({
    pc,
    dataChannel,
    roomId,
  }: {
    pc: RTCPeerConnection;
    dataChannel: RTCDataChannel | null;
    roomId: string;
  }) => set({ pc, dataChannel, roomId }),
}));
