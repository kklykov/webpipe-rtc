import { nameConfig } from "@/config/uniqueNames";
import { useMemo } from "react";
import { uniqueNamesGenerator } from "unique-names-generator";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

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
  userName: string;

  // Video call states
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoCallActive: boolean;
  isLocalVideoEnabled: boolean;
  isLocalAudioEnabled: boolean;
  isRemoteVideoEnabled: boolean;
  isRemoteAudioEnabled: boolean;
  isIncomingCall: boolean;
  isOutgoingCall: boolean;
  callStartTime: Date | null;

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
  setUserName: (name: string) => void;

  // Video call actions
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setVideoCallActive: (active: boolean) => void;
  setLocalVideoEnabled: (enabled: boolean) => void;
  setLocalAudioEnabled: (enabled: boolean) => void;
  setRemoteVideoEnabled: (enabled: boolean) => void;
  setRemoteAudioEnabled: (enabled: boolean) => void;
  setIncomingCall: (incoming: boolean) => void;
  setOutgoingCall: (outgoing: boolean) => void;
  setCallStartTime: (time: Date | null) => void;

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
  userName: uniqueNamesGenerator(nameConfig),

  // Video call initial states
  localStream: null,
  remoteStream: null,
  isVideoCallActive: false,
  isLocalVideoEnabled: true,
  isLocalAudioEnabled: true,
  isRemoteVideoEnabled: true,
  isRemoteAudioEnabled: true,
  isIncomingCall: false,
  isOutgoingCall: false,
  callStartTime: null,
};

export const useStore = create<WebRTCState>()(
  subscribeWithSelector((set) => ({
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
      set((state) => {
        const currentTransfer = state.transfers.find((t) => t.id === id);
        if (!currentTransfer) return state;

        // Only create new array if there are actual changes
        const hasChanges = Object.keys(updates).some(
          (key) =>
            currentTransfer[key as keyof FileTransfer] !==
            updates[key as keyof FileTransfer]
        );

        if (!hasChanges) return state;

        return {
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
        };
      }),
    setCurrentReceivingFileId: (id) => set({ currentReceivingFileId: id }),
    setPeerName: (name) => set({ peerName: name }),
    setUserName: (name) => set({ userName: name }),

    // Video call actions
    setLocalStream: (stream) => set({ localStream: stream }),
    setRemoteStream: (stream) => set({ remoteStream: stream }),
    setVideoCallActive: (active) => set({ isVideoCallActive: active }),
    setLocalVideoEnabled: (enabled) => set({ isLocalVideoEnabled: enabled }),
    setLocalAudioEnabled: (enabled) => set({ isLocalAudioEnabled: enabled }),
    setRemoteVideoEnabled: (enabled) => set({ isRemoteVideoEnabled: enabled }),
    setRemoteAudioEnabled: (enabled) => set({ isRemoteAudioEnabled: enabled }),
    setIncomingCall: (incoming) => set({ isIncomingCall: incoming }),
    setOutgoingCall: (outgoing) => set({ isOutgoingCall: outgoing }),
    setCallStartTime: (time) => set({ callStartTime: time }),

    resetState: () => set(initialState),
  }))
);

// Granular selectors for better performance
export const useMessages = () => useStore((state) => state.messages);
export const useTransfers = () => useStore((state) => state.transfers);

// Memoized selector that tracks structural changes vs content changes
export const useHistoryLength = () =>
  useStore((state) => state.messages.length + state.transfers.length);

// Hook that only updates when items are added/removed, not when content changes
export const useHistoryStructuralChanges = () => {
  const messages = useStore((state) => state.messages);
  const transfers = useStore((state) => state.transfers);

  return useMemo(() => {
    // Only include stable properties that don't change during transfers
    const messageIds = messages.map((m) => ({
      id: m.id,
      timestamp: m.timestamp,
    }));
    const transferIds = transfers.map((t) => ({
      id: t.id,
      timestamp: t.timestamp,
    }));

    return [...messageIds, ...transferIds].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }, [
    // Use string representations to avoid deep comparison issues
    messages.map((m) => `${m.id}-${m.timestamp.getTime()}`).join(","),
    transfers.map((t) => `${t.id}-${t.timestamp.getTime()}`).join(","),
  ]);
};

// Ultra-optimized combined history hook
export const useUltraOptimizedCombinedHistory = () => {
  const messages = useMessages();
  const transfers = useTransfers();

  // Memoize based on actual content, not just array references
  return useMemo(() => {
    const messagesWithType = messages.map((m, index) => ({
      ...m,
      type: "message" as const,
      // Add stable key for React
      _key: `message-${m.id}-${index}`,
    }));

    const transfersWithType = transfers.map((t, index) => ({
      ...t,
      type: "transfer" as const,
      // Add stable key for React
      _key: `transfer-${t.id}-${index}`,
    }));

    const combined = [...messagesWithType, ...transfersWithType];
    combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return combined;
  }, [messages, transfers]);
};

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

// Optimized version that maintains stable references for unchanged items
export const useOptimizedCombinedHistory = () => {
  const messages = useStore((state) => state.messages);
  const transfers = useStore((state) => state.transfers);

  return useMemo(() => {
    const messagesWithType = messages.map((m) => ({
      ...m,
      type: "message" as const,
    }));

    const transfersWithType = transfers.map((t) => ({
      ...t,
      type: "transfer" as const,
    }));

    const combined = [...messagesWithType, ...transfersWithType];
    combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return combined;
  }, [messages, transfers]);
};
