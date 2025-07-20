import { useMemo } from "react";
import { create } from "zustand";

interface Message {
  id: string;
  text: string;
  isOwn: boolean;
  timestamp: Date;
}

export type FileStatus =
  // Sender statuses
  | "queued"
  | "sending"
  | "sent"
  | "downloaded-by-peer"
  // Receiver statuses
  | "receiving"
  | "received"
  // Local (receiver) action
  | "downloaded-by-you";

export interface FileTransfer {
  // Common
  id: string;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  progress: number;
  isOwn: boolean; // True if sent by me, false if received
  timestamp: Date; // When the transfer was created
  lastStatusChange: Date; // When the status was last updated
  // Sender only
  file?: File;
  // Receiver only
  blob?: Blob;
}

interface WebRTCState {
  pc: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  roomId: string | null;
  connected: boolean;
  connectionState: string;
  iceConnectionState: string;
  errorMessage: string | null;
  messages: Message[];
  transfers: FileTransfer[];
  currentReceivingFileId: string | null;
  peerName: string | null;

  // Actions
  setConnection: (connection: Partial<Omit<WebRTCState, "transfers">>) => void;
  setConnected: (connected: boolean) => void;
  setConnectionState: (state: string) => void;
  setIceConnectionState: (state: string) => void;
  setErrorMessage: (error: string | null) => void;
  setRoomId: (roomId: string | null) => void;
  addMessage: (message: Message) => void;
  addTransfer: (
    transfer: Omit<FileTransfer, "timestamp" | "lastStatusChange">
  ) => void;
  addTransfers: (
    transfers: Omit<FileTransfer, "timestamp" | "lastStatusChange">[]
  ) => void;
  updateTransfer: (id: string, updates: Partial<FileTransfer>) => void;
  setCurrentReceivingFileId: (id: string | null) => void;
  setPeerName: (name: string | null) => void;
  resetState: () => void;
}

const initialState = {
  pc: null,
  dataChannel: null,
  roomId: null,
  connected: false,
  connectionState: "new",
  iceConnectionState: "new",
  errorMessage: null,
  messages: [],
  transfers: [],
  currentReceivingFileId: null,
  peerName: null,
};

export const useStore = create<WebRTCState>()((set) => ({
  ...initialState,

  setConnection: (connection) => set(connection),
  setConnected: (connected) => set({ connected }),
  setConnectionState: (state) => set({ connectionState: state }),
  setIceConnectionState: (state) => set({ iceConnectionState: state }),
  setErrorMessage: (error) => set({ errorMessage: error }),
  setRoomId: (id) => set({ roomId: id }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  addTransfer: (transfer) =>
    set((state) => ({
      transfers: [
        ...state.transfers,
        {
          ...transfer,
          timestamp: new Date(),
          lastStatusChange: new Date(),
        } as FileTransfer,
      ],
    })),
  addTransfers: (transfers) =>
    set((state) => ({
      transfers: [
        ...state.transfers,
        ...transfers.map(
          (transfer) =>
            ({
              ...transfer,
              timestamp: new Date(),
              lastStatusChange: new Date(),
            } as FileTransfer)
        ),
      ],
    })),
  updateTransfer: (id, updates) =>
    set((state) => ({
      transfers: state.transfers.map((t) =>
        t.id === id
          ? {
              ...t,
              ...updates,
              // Update lastStatusChange when status changes
              lastStatusChange:
                updates.status && updates.status !== t.status
                  ? new Date()
                  : t.lastStatusChange,
            }
          : t
      ),
    })),
  setCurrentReceivingFileId: (id) => set({ currentReceivingFileId: id }),
  setPeerName: (name) => set({ peerName: name }),
  resetState: () => set(initialState),
}));

// Selector to get combined and sorted history
export const useCombinedHistory = () => {
  const messages = useStore((state) => state.messages);
  const transfers = useStore((state) => state.transfers);

  return useMemo(() => {
    const combined = [
      ...messages.map((m) => ({ ...m, type: "message" as const })),
      ...transfers.map((t) => ({ ...t, type: "transfer" as const })),
    ];
    combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return combined;
  }, [messages, transfers]);
};
