import { WebRTCConnection } from "@/types/webrtc";
import { create } from "zustand";

interface WebRTCState {
  // Connection state
  roomId: string | null;
  pc: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;

  // File transfer state
  file: File | null;

  // Connection status
  isConnected: boolean;
}

interface WebRTCActions {
  // Individual setters
  setPc: (pc: RTCPeerConnection | null) => void;
  setDataChannel: (dataChannel: RTCDataChannel | null) => void;
  setFile: (file: File | null) => void;
  setRoomId: (roomId: string | null) => void;
  setConnected: (connected: boolean) => void;

  // Bulk setter for connection
  setConnection: (
    connection: Partial<WebRTCConnection> & { roomId: string }
  ) => void;

  // Reset all state
  reset: () => void;
}

export type Store = WebRTCState & WebRTCActions;

const initialState: WebRTCState = {
  roomId: null,
  pc: null,
  dataChannel: null,
  file: null,
  isConnected: false,
};

export const useStore = create<Store>((set, get) => ({
  ...initialState,

  // Individual setters
  setPc: (pc) => set({ pc }),
  setDataChannel: (dataChannel) => set({ dataChannel }),
  setFile: (file) => set({ file }),
  setRoomId: (roomId) => set({ roomId }),
  setConnected: (isConnected) => set({ isConnected }),

  // Bulk connection setter
  setConnection: ({ pc, dataChannel, roomId }) =>
    set({
      pc,
      dataChannel,
      roomId,
      isConnected: !!(
        pc &&
        (pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected")
      ),
    }),

  // Reset all state
  reset: () => {
    const { pc, dataChannel } = get();

    // Clean up existing connections
    if (dataChannel) {
      dataChannel.close();
    }
    if (pc) {
      pc.close();
    }

    set(initialState);
  },
}));
