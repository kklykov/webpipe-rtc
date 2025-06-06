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
import {
  createInterval,
  DATA_CHANNEL_CONFIG,
  isConnected,
  isFailed,
  logConnection,
  POLLING_INTERVALS,
} from "@/utils/webrtc-helpers";
import { useEffect, useRef, useState } from "react";

// Función para guardar candidatos ICE locales
async function saveLocalIceCandidate(
  roomId: string,
  event: RTCPeerConnectionIceEvent,
  isCaller: boolean
) {
  if (!event.candidate) {
    console.log("🧊 Recolección de candidatos ICE completada");
    return;
  }

  try {
    await saveIceCandidate(roomId, event.candidate.toJSON(), isCaller);
    console.log(
      `✅ Candidato ICE guardado: ${event.candidate.candidate.substring(
        0,
        30
      )}...`
    );
  } catch (error) {
    console.warn("❌ Error al guardar candidato:", error);
  }
}

// Función para procesar candidatos ICE remotos
async function processRemoteIceCandidates(
  pc: RTCPeerConnection,
  roomId: string,
  isCaller: boolean,
  processedCandidates: Set<string>,
  candidateBuffer: RTCIceCandidate[]
): Promise<boolean> {
  try {
    const candidates = await getRemoteIceCandidates(roomId, isCaller);
    let newCandidatesCount = 0;

    for (const candidateInit of candidates) {
      if (processedCandidates.has(candidateInit._id)) continue;

      processedCandidates.add(candidateInit._id);
      newCandidatesCount++;
      const candidate = new RTCIceCandidate(candidateInit);

      if (pc.remoteDescription) {
        await pc
          .addIceCandidate(candidate)
          .catch((err) => console.warn("⚠️ Error al añadir candidato:", err));
      } else {
        candidateBuffer.push(candidate);
        console.log("📦 Candidato guardado en buffer");
      }
    }

    if (newCandidatesCount > 0) {
      console.log(
        `🔄 Procesados ${newCandidatesCount} nuevos candidatos remotos`
      );
    }

    return isConnected(pc);
  } catch (error) {
    console.warn("❌ Error al obtener candidatos remotos:", error);
    return false;
  }
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
      cleanupFunctions.current.forEach((cleanup) => cleanup?.());
      cleanupFunctions.current = [];
    };
  }, []);

  // Configurar eventos de conexión
  const setupConnectionEvents = (pc: RTCPeerConnection) => {
    pc.onconnectionstatechange = () => {
      logConnection("Estado de conexión cambió", pc);
      setConnectionState(pc.connectionState);

      const connected = isConnected(pc);
      setConnected(connected);

      if (connected) {
        console.log("🎉 ¡Conexión WebRTC establecida exitosamente!");
      } else if (pc.connectionState === "failed") {
        console.warn("❌ Conexión WebRTC falló");
      }
    };

    pc.oniceconnectionstatechange = () => {
      logConnection("Estado ICE cambió", pc);
      setIceConnectionState(pc.iceConnectionState);

      const connected = isConnected(pc);
      setConnected(connected);

      if (pc.iceConnectionState === "connected") {
        console.log("🧊 Conexión ICE establecida");
      } else if (pc.iceConnectionState === "failed") {
        console.warn("❌ Conexión ICE falló, reiniciando...");
        pc.restartIce?.();
      } else if (pc.iceConnectionState === "disconnected") {
        console.warn("⚠️ Conexión ICE desconectada");
      }
    };

    // Agregar más eventos para debugging
    pc.onicegatheringstatechange = () => {
      console.log(`🔍 Estado de recolección ICE: ${pc.iceGatheringState}`);
    };

    pc.onsignalingstatechange = () => {
      console.log(`📡 Estado de señalización: ${pc.signalingState}`);
    };
  };

  // Configurar eventos del canal de datos
  const setupDataChannelEvents = (
    channel: RTCDataChannel,
    isCallee = false
  ) => {
    const suffix = isCallee ? " (callee)" : "";

    channel.onmessage = (e) =>
      console.log(`📩 Mensaje recibido${suffix}:`, e.data);
    channel.onopen = () => {
      console.log(`📢 Canal de datos abierto${suffix}`);
      setConnected(true);
    };
    channel.onclose = () => {
      console.log(`🚫 Canal de datos cerrado${suffix}`);
      setConnected(false);
    };
    channel.onerror = (e) => {
      console.warn(`❌ Error en canal de datos${suffix}:`, e);
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

    // Manejar candidatos ICE locales
    pc.onicecandidate = (event) =>
      saveLocalIceCandidate(roomId, event, isCaller);

    // Procesar candidatos del buffer cuando se establezca remoteDescription
    const processBufferedCandidates = async () => {
      if (candidateBuffer.length > 0 && pc.remoteDescription) {
        console.log(
          `📦 Procesando ${candidateBuffer.length} candidatos del buffer`
        );
        for (const candidate of candidateBuffer) {
          await pc
            .addIceCandidate(candidate)
            .catch((err) =>
              console.warn("⚠️ Error al añadir candidato del buffer:", err)
            );
        }
        candidateBuffer.length = 0;
      }
    };

    // Interceptar setRemoteDescription para procesar buffer
    const originalSetRemoteDescription = pc.setRemoteDescription.bind(pc);
    pc.setRemoteDescription = async (description) => {
      console.log("🔧 Estableciendo remoteDescription...");
      const result = await originalSetRemoteDescription(description);
      console.log("✅ RemoteDescription establecido");

      // Pequeño delay para asegurar que la descripción esté completamente configurada
      await new Promise((resolve) => setTimeout(resolve, 100));
      await processBufferedCandidates();
      return result;
    };

    // Procesar candidatos remotos inmediatamente (puede que ya haya algunos)
    console.log("🔍 Verificando candidatos ICE existentes...");
    await processRemoteIceCandidates(
      pc,
      roomId,
      isCaller,
      processedCandidates,
      candidateBuffer
    );

    // Polling para candidatos remotos con limpieza automática
    const stopPolling = createInterval(
      async () => {
        const connected = await processRemoteIceCandidates(
          pc,
          roomId,
          isCaller,
          processedCandidates,
          candidateBuffer
        );
        if (connected) {
          console.log(
            "🎉 Conexión establecida, deteniendo polling de candidatos ICE"
          );
          stopPolling();
        }
      },
      POLLING_INTERVALS.ICE_CANDIDATES,
      () => isConnected(pc)
    );

    return () => {
      stopPolling();
      // Restaurar método original
      if (pc.setRemoteDescription !== originalSetRemoteDescription) {
        pc.setRemoteDescription = originalSetRemoteDescription;
      }
    };
  };

  // Escuchar respuesta remota (para el caller)
  const listenForAnswer = async (pc: RTCPeerConnection, roomId: string) => {
    console.log("👂 Iniciando escucha de respuesta...");

    const stopPolling = createInterval(
      async () => {
        try {
          const answer = await getRemoteAnswer(roomId);
          if (answer && pc.currentRemoteDescription === null) {
            console.log(
              "📥 Respuesta recibida, estableciendo remoteDescription"
            );

            try {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              console.log("✅ Respuesta establecida exitosamente");
              stopPolling();
            } catch (error) {
              console.warn("⚠️ Error al establecer respuesta:", error);

              // Reintento automático con delay
              setTimeout(async () => {
                if (pc.currentRemoteDescription === null) {
                  try {
                    console.log("🔄 Reintentando establecer respuesta...");
                    await pc.setRemoteDescription(
                      new RTCSessionDescription(answer)
                    );
                    console.log("✅ Respuesta establecida en reintento");
                    stopPolling();
                  } catch (retryError) {
                    console.warn("❌ Error en reintento:", retryError);
                  }
                }
              }, 1000);
            }
          }
        } catch (error) {
          console.warn("❌ Error al verificar respuesta:", error);
        }
      },
      POLLING_INTERVALS.ANSWER,
      () => isConnected(pc) || pc.currentRemoteDescription !== null
    );

    return stopPolling;
  };

  // Configurar monitoreo de estado de sala
  const setupStatusMonitoring = (roomId: string, pc: RTCPeerConnection) => {
    let isConnectedState = false;
    let slowPollingCleanup: (() => void) | null = null;

    const stopPolling = createInterval(
      async () => {
        await checkStatus(roomId);

        const currentlyConnected = isConnected(pc);

        // Cambiar a polling lento cuando se conecte
        if (currentlyConnected && !isConnectedState) {
          console.log(
            "🔄 Conexión establecida, cambiando a polling de baja frecuencia"
          );
          isConnectedState = true;
          stopPolling();

          // Iniciar polling lento
          slowPollingCleanup = createInterval(
            async () => {
              await checkStatus(roomId);
            },
            POLLING_INTERVALS.STATUS_SLOW,
            () => isFailed(pc)
          );
        }
      },
      POLLING_INTERVALS.STATUS_FREQUENT,
      () => isFailed(pc)
    );

    return () => {
      stopPolling();
      if (slowPollingCleanup) {
        slowPollingCleanup();
      }
    };
  };

  // Crear una nueva conexión (caller)
  const createConnection = async (iceServers?: RTCIceServer[]) => {
    try {
      setErrorMessage(null);
      const pc = createPeerConnection(iceServers);

      // IMPORTANTE: Configurar eventos ANTES de crear la oferta
      setupConnectionEvents(pc);

      // Crear canal de datos ANTES de crear la oferta
      const channel = setupDataChannelEvents(
        pc.createDataChannel(DATA_CHANNEL_CONFIG.label, DATA_CHANNEL_CONFIG)
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
      console.log(`🏠 Sala creada: ${roomId}`);

      // IMPORTANTE: Configurar manejo de ICE DESPUÉS de crear la sala pero ANTES de otros polling
      const cleanupIce = await setupIceCandidateHandling(pc, roomId, true);

      // Configurar polling para respuesta
      const cleanupAnswer = await listenForAnswer(pc, roomId);

      // Configurar monitoreo de estado al final
      const cleanupStatus = setupStatusMonitoring(roomId, pc);

      cleanupFunctions.current.push(cleanupIce, cleanupAnswer, cleanupStatus);

      // Actualizar estado al final
      setDataChannel(channel);
      setConnection({ pc, dataChannel: channel, roomId });

      console.log("🚀 Configuración de caller completada, esperando callee...");
    } catch (error) {
      console.warn("❌ Error al crear conexión:", error);
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
      console.log(`🔌 Intentando unirse a sala: ${roomId}`);

      const { offer } = await fetchOffer(roomId);
      const pc = createPeerConnection(iceServers);

      // IMPORTANTE: Configurar eventos ANTES de establecer descripciones
      setupConnectionEvents(pc);

      // Configurar manejo de canal de datos entrante ANTES de establecer oferta remota
      pc.ondatachannel = (event) => {
        console.log(`📡 Canal de datos recibido: ${event.channel.label}`);
        const channel = setupDataChannelEvents(event.channel, true);
        setDataChannel(channel);
      };

      // IMPORTANTE: Configurar ICE handling ANTES de establecer descripciones
      const cleanupIce = await setupIceCandidateHandling(pc, roomId, false);

      // Establecer oferta remota
      console.log("📥 Estableciendo oferta remota...");
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Crear y establecer respuesta
      console.log("📤 Creando respuesta...");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Guardar respuesta en Firebase
      console.log("💾 Guardando respuesta en Firebase...");
      await saveAnswer(roomId, answer);

      // Configurar monitoreo de estado
      const cleanupStatus = setupStatusMonitoring(roomId, pc);

      cleanupFunctions.current.push(cleanupIce, cleanupStatus);

      setRoomId(roomId);
      setConnection({ pc, dataChannel: null, roomId });

      console.log("🎯 Configuración de callee completada");
    } catch (error) {
      console.warn("❌ Error al unirse a la sala:", error);
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
      console.log("📤 Mensaje enviado:", msg);
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
