"use client";

import {
  checkStatus,
  createRoom,
  fetchOffer,
  getRemoteAnswer,
  getRemoteIceCandidates,
  saveAnswer,
  saveIceCandidate,
} from "@/app/actions";
import { createPeerConnection } from "@/config/webrtc";
import { useStore } from "@/store/main";
import { useEffect, useRef, useState } from "react";

// Función para guardar candidatos ICE locales
async function saveLocalIceCandidate(
  roomId: string,
  event: RTCPeerConnectionIceEvent,
  isCaller: boolean
) {
  if (!event.candidate) {
    console.log("Recolección de candidatos ICE completada");
    return;
  }

  try {
    await saveIceCandidate(roomId, event.candidate.toJSON(), isCaller);
    console.log(
      `Candidato ICE guardado: ${event.candidate.candidate.substring(0, 30)}...`
    );
  } catch (error) {
    console.warn("Error al guardar candidato:", error);
  }
}

// Función para procesar y añadir candidatos ICE remotos
async function processRemoteIceCandidates(
  pc: RTCPeerConnection,
  roomId: string,
  isCaller: boolean,
  processedCandidates: Set<string>,
  candidateBuffer: RTCIceCandidate[]
) {
  try {
    const candidates = await getRemoteIceCandidates(roomId, isCaller);
    let newCandidatesCount = 0;

    for (const candidateInit of candidates) {
      if (processedCandidates.has(candidateInit._id)) {
        continue;
      }

      processedCandidates.add(candidateInit._id);
      newCandidatesCount++;
      const candidate = new RTCIceCandidate(candidateInit);

      if (pc.remoteDescription) {
        await pc
          .addIceCandidate(candidate)
          .catch((err) => console.warn("Error al añadir candidato:", err));
      } else {
        // Guardar en buffer si no hay remoteDescription aún
        candidateBuffer.push(candidate);
        console.log("Candidato guardado en buffer");
      }
    }

    if (newCandidatesCount > 0) {
      console.log(`Procesados ${newCandidatesCount} nuevos candidatos remotos`);
    }

    return (
      pc.connectionState === "connected" ||
      pc.iceConnectionState === "connected"
    );
  } catch (error) {
    console.warn("Error al obtener candidatos remotos:", error);
    return false;
  }
}

// Configura monitoreo de estado de sala
function setupStatusMonitoring(roomId: string, pc: RTCPeerConnection) {
  let intervalId: NodeJS.Timeout | null = null;
  let isConnected = false;

  const checkRoomStatus = async () => {
    try {
      await checkStatus(roomId);

      const currentlyConnected =
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected";

      // Si acabamos de conectarnos, cambiar a polling de baja frecuencia
      if (currentlyConnected && !isConnected) {
        console.log(
          "Conexión establecida, cambiando a polling de baja frecuencia"
        );
        isConnected = true;

        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(checkRoomStatus, 30000); // 30 segundos
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        console.log("Conexión fallida o cerrada, deteniendo monitoreo");
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    } catch (error) {
      console.warn("Error al verificar estado:", error);
    }
  };

  // Primera verificación inmediata
  checkRoomStatus();

  // Configuración de verificación frecuente inicial (5 segundos)
  intervalId = setInterval(checkRoomStatus, 5000);

  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}

// Hook principal
export function useWebRTC() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [connectionState, setConnectionState] = useState<string>("new");
  const [iceConnectionState, setIceConnectionState] = useState<string>("new");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cleanupFunctions = useRef<(() => void)[]>([]);

  const setConnection = useStore((state) => state.setConnection);

  // Limpieza al desmontar el componente
  useEffect(() => {
    return () => {
      cleanupFunctions.current.forEach((cleanup) => cleanup && cleanup());
      cleanupFunctions.current = [];
    };
  }, []);

  // Configurar eventos de conexión en el peer connection
  const setupConnectionEvents = (pc: RTCPeerConnection) => {
    pc.onconnectionstatechange = () => {
      console.log(`Estado de conexión: ${pc.connectionState}`);
      setConnectionState(pc.connectionState);

      if (pc.connectionState === "connected") {
        setConnected(true);
      } else if (
        ["disconnected", "failed", "closed"].includes(pc.connectionState)
      ) {
        setConnected(false);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`Estado de conexión ICE: ${pc.iceConnectionState}`);
      setIceConnectionState(pc.iceConnectionState);

      // Actualizar estado de conexión también basado en ICE
      if (pc.iceConnectionState === "connected") {
        setConnected(true);
      } else if (
        ["failed", "disconnected", "closed"].includes(pc.iceConnectionState)
      ) {
        setConnected(false);
      }

      if (pc.iceConnectionState === "failed") {
        pc.restartIce?.();
      }
    };
  };

  // Configurar eventos del canal de datos
  const setupDataChannelEvents = (
    channel: RTCDataChannel,
    isCallee = false
  ) => {
    const suffix = isCallee ? " (callee)" : "";

    channel.onmessage = (e) => {
      console.log(`📩 Mensaje recibido${suffix}:`, e.data);
    };

    channel.onopen = () => {
      console.log(`📢 Canal de datos abierto${suffix}`);
      setConnected(true);
    };

    channel.onclose = () => {
      console.log(`🚫 Canal de datos cerrado${suffix}`);
      setConnected(false);
    };

    channel.onerror = (e) => {
      console.warn(`Error en canal de datos${suffix}:`, e);
      setErrorMessage(`Error en canal de datos${suffix}`);
    };

    return channel;
  };

  // Configurar manejo de candidatos ICE
  const setupIceCandidateHandling = async (
    pc: RTCPeerConnection,
    roomId: string,
    isCaller: boolean
  ) => {
    const processedCandidates = new Set<string>();
    const candidateBuffer: RTCIceCandidate[] = [];
    let pollingActive = true;

    // Manejar candidatos ICE locales
    pc.onicecandidate = (event) =>
      saveLocalIceCandidate(roomId, event, isCaller);

    // Función para procesar candidatos del buffer cuando se establezca remoteDescription
    const processBufferedCandidates = async () => {
      if (candidateBuffer.length > 0 && pc.remoteDescription) {
        console.log(
          `Procesando ${candidateBuffer.length} candidatos del buffer`
        );
        for (const candidate of candidateBuffer) {
          await pc
            .addIceCandidate(candidate)
            .catch((err) =>
              console.warn("Error al añadir candidato del buffer:", err)
            );
        }
        candidateBuffer.length = 0;
      }
    };

    // Interceptar setRemoteDescription para procesar buffer
    const originalSetRemoteDescription = pc.setRemoteDescription.bind(pc);
    pc.setRemoteDescription = async (description) => {
      const result = await originalSetRemoteDescription(description);
      await processBufferedCandidates();
      return result;
    };

    // Polling para candidatos remotos
    const pollInterval = setInterval(async () => {
      if (!pollingActive) {
        clearInterval(pollInterval);
        return;
      }

      // Verificar si ya estamos conectados
      if (
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected"
      ) {
        console.log(
          "Conexión establecida, deteniendo polling de candidatos ICE"
        );
        pollingActive = false;
        clearInterval(pollInterval);
        return;
      }

      const isConnected = await processRemoteIceCandidates(
        pc,
        roomId,
        isCaller,
        processedCandidates,
        candidateBuffer
      );

      if (isConnected) {
        console.log(
          "Conexión detectada por processRemoteIceCandidates, deteniendo polling"
        );
        pollingActive = false;
        clearInterval(pollInterval);
      }
    }, 2000);

    // Procesar candidatos remotos inmediatamente
    await processRemoteIceCandidates(
      pc,
      roomId,
      isCaller,
      processedCandidates,
      candidateBuffer
    );

    return () => {
      pollingActive = false;
      clearInterval(pollInterval);
      // Restaurar método original
      if (pc.setRemoteDescription !== originalSetRemoteDescription) {
        pc.setRemoteDescription = originalSetRemoteDescription;
      }
    };
  };

  // Escuchar respuesta remota (para el caller)
  const listenForAnswer = async (pc: RTCPeerConnection, roomId: string) => {
    let isPolling = true;
    let intervalId: NodeJS.Timeout | null = null;

    const checkForAnswer = async () => {
      if (!isPolling) {
        if (intervalId) clearInterval(intervalId);
        return;
      }

      // Verificar si ya estamos conectados o si ya tenemos respuesta
      if (
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected" ||
        pc.currentRemoteDescription !== null
      ) {
        console.log(
          "Conexión establecida o respuesta recibida, deteniendo polling de respuesta"
        );
        isPolling = false;
        if (intervalId) clearInterval(intervalId);
        return;
      }

      try {
        const answer = await getRemoteAnswer(roomId);
        if (answer && pc.currentRemoteDescription === null) {
          console.log("Respuesta recibida, estableciendo remoteDescription");
          await pc
            .setRemoteDescription(new RTCSessionDescription(answer))
            .then(() => {
              console.log("Respuesta establecida exitosamente");
              isPolling = false;
              if (intervalId) clearInterval(intervalId);
            })
            .catch((error) => {
              console.warn("Error al establecer respuesta:", error);
              // Reintento en caso de error
              setTimeout(async () => {
                if (pc.currentRemoteDescription === null) {
                  try {
                    await pc.setRemoteDescription(
                      new RTCSessionDescription(answer)
                    );
                    console.log("Respuesta establecida en reintento");
                    isPolling = false;
                    if (intervalId) clearInterval(intervalId);
                  } catch (retryError) {
                    console.warn("Error en reintento:", retryError);
                  }
                }
              }, 1000);
            });
        }
      } catch (error) {
        console.warn("Error al verificar respuesta:", error);
      }
    };

    // Verificación inmediata inicial
    await checkForAnswer();

    // Solo configurar intervalo si aún estamos polling
    if (isPolling) {
      intervalId = setInterval(checkForAnswer, 1000);
    }

    return () => {
      isPolling = false;
      if (intervalId) clearInterval(intervalId);
    };
  };

  // Crear una nueva conexión (caller)
  const createConnection = async (iceServers?: RTCIceServer[]) => {
    try {
      setErrorMessage(null);
      const pc = createPeerConnection(iceServers);

      // Configurar eventos de conexión
      setupConnectionEvents(pc);

      // Crear canal de datos
      const channel = setupDataChannelEvents(
        pc.createDataChannel("fileTransfer", {
          ordered: true,
          maxRetransmits: 3,
        })
      );

      // Crear y establecer oferta
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      // Crear sala con la oferta
      const { roomId } = await createRoom(offer);
      setRoomId(roomId);
      console.log(`Sala creada: ${roomId}`);

      // Configurar funcionalidades
      const cleanupIce = await setupIceCandidateHandling(pc, roomId, true);
      const cleanupAnswer = await listenForAnswer(pc, roomId);
      const cleanupStatus = setupStatusMonitoring(roomId, pc);

      // Guardar referencias para limpieza
      cleanupFunctions.current.push(cleanupIce, cleanupAnswer, cleanupStatus);

      // Almacenar en store global
      setDataChannel(channel);
      setConnection({ pc, dataChannel: channel, roomId });
    } catch (error) {
      console.warn("Error al crear conexión:", error);
      setErrorMessage(`Error al crear conexión: ${error}`);
    }
  };

  // Unirse a una conexión existente (callee)
  const joinConnection = async (
    roomId: string,
    iceServers?: RTCIceServer[]
  ) => {
    try {
      setErrorMessage(null);

      // Obtener la oferta de la sala
      const { offer } = await fetchOffer(roomId);
      const pc = createPeerConnection(iceServers);

      // Configurar eventos de conexión
      setupConnectionEvents(pc);

      // Manejar canal de datos entrante
      pc.ondatachannel = (event) => {
        const channel = setupDataChannelEvents(event.channel, true);
        setDataChannel(channel);
      };

      // Establecer oferta remota
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Crear y establecer respuesta
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await saveAnswer(roomId, answer);

      // Configurar funcionalidades
      const cleanupIce = await setupIceCandidateHandling(pc, roomId, false);
      const cleanupStatus = setupStatusMonitoring(roomId, pc);

      // Guardar referencias para limpieza
      cleanupFunctions.current.push(cleanupIce, cleanupStatus);

      // Actualizar estado
      setRoomId(roomId);
      setConnection({ pc, dataChannel: null, roomId });
    } catch (error) {
      console.warn("Error al unirse a la sala:", error);
      setErrorMessage(`Error al unirse a la sala: ${error}`);
    }
  };

  // Enviar mensaje a través del canal de datos
  const sendMessage = (msg: string) => {
    if (!dataChannel) {
      console.warn("❌ Canal de datos no inicializado");
      return;
    }

    if (dataChannel.readyState === "open") {
      dataChannel.send(msg);
    } else {
      console.warn(
        `⚠️ Canal en estado: ${dataChannel.readyState}, no se puede enviar mensaje`
      );
    }
  };

  return {
    roomId,
    connected,
    connectionState,
    iceConnectionState,
    errorMessage,
    createConnection,
    joinConnection,
    sendMessage,
    dataChannel,
  };
}
