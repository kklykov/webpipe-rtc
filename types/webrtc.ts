// Tipos para WebRTC
export interface WebRTCConnection {
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  roomId: string;
}

export interface RoomData {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
}

export interface RoomStatus {
  exists: boolean;
  hasOffer?: boolean;
  hasAnswer?: boolean;
  callerCandidatesCount?: number;
  calleeCandidatesCount?: number;
}

export interface ICECandidateWithId extends RTCIceCandidateInit {
  _id: string;
  timestamp?: number;
}

export type ConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export type ICEConnectionState =
  | "new"
  | "checking"
  | "connected"
  | "completed"
  | "failed"
  | "disconnected"
  | "closed";

// Estados de conexión que indican éxito
export const CONNECTED_STATES: ConnectionState[] = ["connected"];
export const CONNECTED_ICE_STATES: ICEConnectionState[] = [
  "connected",
  "completed",
];

// Estados de conexión que indican fallo
export const FAILED_STATES: ConnectionState[] = [
  "failed",
  "closed",
  "disconnected",
];
export const FAILED_ICE_STATES: ICEConnectionState[] = [
  "failed",
  "closed",
  "disconnected",
];
