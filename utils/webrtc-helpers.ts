import {
  CONNECTED_ICE_STATES,
  CONNECTED_STATES,
  ConnectionState,
  FAILED_ICE_STATES,
  FAILED_STATES,
  ICEConnectionState,
} from "@/types/webrtc";

// Constantes de configuración
export const POLLING_INTERVALS = {
  ICE_CANDIDATES: 2000,
  ANSWER: 1000,
  STATUS_FREQUENT: 5000,
  STATUS_SLOW: 30000,
} as const;

export const DATA_CHANNEL_CONFIG = {
  label: "fileTransfer",
  ordered: true,
  maxRetransmits: 3,
} as const;

// Utilidades para verificar estados de conexión
export function isConnected(pc: RTCPeerConnection): boolean {
  return (
    CONNECTED_STATES.includes(pc.connectionState as ConnectionState) ||
    CONNECTED_ICE_STATES.includes(pc.iceConnectionState as ICEConnectionState)
  );
}

export function isFailed(pc: RTCPeerConnection): boolean {
  return (
    FAILED_STATES.includes(pc.connectionState as ConnectionState) ||
    FAILED_ICE_STATES.includes(pc.iceConnectionState as ICEConnectionState)
  );
}

// Utilidad para crear intervalos con limpieza automática
export function createInterval(
  callback: () => void | Promise<void>,
  interval: number,
  stopCondition?: () => boolean
): () => void {
  let isActive = true;

  const intervalId = setInterval(async () => {
    if (!isActive || (stopCondition && stopCondition())) {
      clearInterval(intervalId);
      return;
    }

    try {
      await callback();
    } catch (error) {
      console.warn("Error en intervalo:", error);
    }
  }, interval);

  return () => {
    isActive = false;
    clearInterval(intervalId);
  };
}

// Utilidad para logs consistentes
export function logConnection(message: string, pc: RTCPeerConnection) {
  console.log(
    `%c${message}`,
    "font-weight: bold;",
    `Connection: ${pc.connectionState}, ICE: ${pc.iceConnectionState}`
  );
}

// Utilidad para obtener el nombre de la colección de candidatos
export function getCandidatesCollection(
  isCaller: boolean,
  isRemote: boolean = false
): string {
  if (isCaller) {
    return isRemote ? "calleeCandidates" : "callerCandidates";
  } else {
    return isRemote ? "callerCandidates" : "calleeCandidates";
  }
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
