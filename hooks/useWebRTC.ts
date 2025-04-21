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
import { useCallback, useEffect, useRef, useState } from "react";

// Función que maneja los candidatos ICE usando server actions
async function handleIceCandidates(
  pc: RTCPeerConnection,
  roomId: string,
  isCaller: boolean
) {
  // Buffer para almacenar candidatos hasta que remoteDescription esté establecido
  const iceCandidatesBuffer: RTCIceCandidate[] = [];
  let isPolling = true;

  // Set para rastrear candidatos ya procesados
  const processedCandidates = new Set<string>();

  // Procesar candidatos remotos
  const processRemoteCandidates = async () => {
    // Detener el polling si ya estamos conectados o si se solicitó detener
    if (
      !isPolling ||
      pc.connectionState === "connected" ||
      pc.iceConnectionState === "connected"
    ) {
      console.log("Conexión establecida, deteniendo polling de candidatos ICE");
      isPolling = false;
      clearInterval(pollingId);
      return;
    }

    try {
      const candidates = await getRemoteIceCandidates(roomId, isCaller);
      let newCandidatesCount = 0;

      for (const candidateInit of candidates) {
        // Usamos el ID para rastrear candidatos ya procesados
        if (processedCandidates.has(candidateInit._id)) {
          continue;
        }

        processedCandidates.add(candidateInit._id);
        newCandidatesCount++;

        const candidate = new RTCIceCandidate(candidateInit);

        if (pc.remoteDescription) {
          await pc
            .addIceCandidate(candidate)
            .then(() =>
              console.log(
                `Candidato añadido: ${candidateInit.candidate?.substring(
                  0,
                  30
                )}...`
              )
            )
            .catch((err) => console.warn("Error al añadir candidato:", err));
        } else {
          console.log(
            `Guardando candidato en buffer: ${candidateInit.candidate?.substring(
              0,
              30
            )}...`
          );
          iceCandidatesBuffer.push(candidate);
        }
      }

      if (newCandidatesCount > 0) {
        console.log(
          `Procesados ${newCandidatesCount} nuevos candidatos remotos`
        );
      }
    } catch (error) {
      console.warn("Error al obtener candidatos remotos:", error);
    }
  };

  // Configuramos polling más frecuente
  const pollInterval = 2000;
  const pollingId = setInterval(processRemoteCandidates, pollInterval);

  // Guardar candidatos locales en Firebase mediante server action
  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      try {
        await saveIceCandidate(roomId, event.candidate.toJSON(), isCaller);
        console.log(
          `Candidato ICE guardado: ${event.candidate.candidate.substring(
            0,
            30
          )}...`
        );
      } catch (error) {
        console.warn("Error al guardar candidato:", error);
      }
    } else {
      console.log("Recolección de candidatos ICE completada");
    }
  };

  // Detectar cuando se establece remoteDescription para aplicar candidatos del buffer
  const originalSetRemoteDescription = pc.setRemoteDescription.bind(pc);
  pc.setRemoteDescription = async (description) => {
    console.log("Estableciendo remoteDescription...");
    const result = await originalSetRemoteDescription(description);
    console.log("RemoteDescription establecido correctamente");

    // Procesar candidatos almacenados
    if (iceCandidatesBuffer.length > 0) {
      console.log(
        `Procesando ${iceCandidatesBuffer.length} candidatos del buffer`
      );

      // Añadimos un pequeño retraso para asegurar que remoteDescription esté completamente configurado
      await new Promise((resolve) => setTimeout(resolve, 100));

      for (const candidate of iceCandidatesBuffer) {
        await pc
          .addIceCandidate(candidate)
          .then(() => console.log("Candidato del buffer añadido con éxito"))
          .catch((err) =>
            console.warn("Error al añadir candidato del buffer:", err)
          );
      }
      iceCandidatesBuffer.length = 0;
    } else {
      console.log("No hay candidatos en buffer para procesar");
    }

    return result;
  };

  // Iniciar con una carga de candidatos existentes
  await processRemoteCandidates();

  // Devolver función que restaura el método original y limpia el intervalo
  return () => {
    isPolling = false;
    clearInterval(pollingId);
    if (pc.setRemoteDescription !== originalSetRemoteDescription) {
      pc.setRemoteDescription = originalSetRemoteDescription;
    }
  };
}

// Función para monitorear cambios en la sala (para detectar respuesta)
async function pollForAnswer(
  roomId: string,
  pc: RTCPeerConnection,
  interval = 1000
) {
  let lastAnswerCheck = false;
  let isPolling = true;

  const checkAnswerLoop = async () => {
    // Detener el polling si ya estamos conectados o si la respuesta ya fue procesada
    if (
      !isPolling ||
      pc.connectionState === "connected" ||
      pc.iceConnectionState === "connected" ||
      pc.currentRemoteDescription !== null
    ) {
      console.log(
        "Conexión establecida o respuesta recibida, deteniendo polling de respuesta"
      );
      isPolling = false;
      clearInterval(intervalId);
      return;
    }

    try {
      const answer = await getRemoteAnswer(roomId);

      if (answer && !lastAnswerCheck && pc.currentRemoteDescription === null) {
        console.log("Respuesta recibida:", answer);
        lastAnswerCheck = true;

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log("Respuesta establecida exitosamente");

          // Detenemos el polling después de establecer la respuesta
          isPolling = false;
          clearInterval(intervalId);
        } catch (error) {
          console.warn("Error al establecer la respuesta:", error);

          // Si hay error al establecer la respuesta, intentamos de nuevo después de un breve retraso
          setTimeout(async () => {
            try {
              if (pc.currentRemoteDescription === null) {
                console.log("Reintentando establecer respuesta...");
                await pc.setRemoteDescription(
                  new RTCSessionDescription(answer)
                );
                console.log("Respuesta establecida en reintento");

                // Detenemos el polling después de establecer la respuesta
                isPolling = false;
                clearInterval(intervalId);
              }
            } catch (retryError) {
              console.warn("Error en reintento:", retryError);
            }
          }, 1000);
        }
      }
    } catch (error) {
      console.warn("Error al verificar respuesta:", error);
    }
  };

  // Primera verificación inmediata
  await checkAnswerLoop();

  // Configurar intervalo
  const intervalId = setInterval(checkAnswerLoop, interval);

  // Devolver función de limpieza
  return () => {
    isPolling = false;
    clearInterval(intervalId);
  };
}

export function useWebRTC() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [connectionState, setConnectionState] = useState<string>("new");
  const [iceConnectionState, setIceConnectionState] = useState<string>("new");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cleanupFunctions = useRef<(() => void)[]>([]);
  const statusPollingRef = useRef<NodeJS.Timeout | null>(null);

  const setConnection = useStore((state) => state.setConnection);

  // Limpieza de recursos al desmontar
  useEffect(() => {
    return () => {
      // Ejecutar todas las funciones de limpieza
      cleanupFunctions.current.forEach((cleanup) => cleanup && cleanup());

      // Limpiar intervalo de status polling
      if (statusPollingRef.current) {
        clearInterval(statusPollingRef.current);
        statusPollingRef.current = null;
      }
    };
  }, []);

  // Función para iniciar el monitoreo de estado con frecuencia adaptativa
  const startStatusPolling = useCallback(
    (roomId: string, pc: RTCPeerConnection) => {
      // Limpiamos cualquier intervalo anterior
      if (statusPollingRef.current) {
        clearInterval(statusPollingRef.current);
      }

      // Configuramos el intervalo inicial (frecuente)
      const initialInterval = 5000; // 5 segundos

      const checkStatus = async () => {
        // Si estamos conectados, reducimos la frecuencia
        if (
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected"
        ) {
          // Detenemos el polling frecuente
          if (statusPollingRef.current) {
            clearInterval(statusPollingRef.current);
          }

          // Configuramos polling de baja frecuencia
          statusPollingRef.current = setInterval(async () => {
            try {
              const status = await checkRoomStatus(roomId);
              console.log("Verificación periódica de sala:", status);
            } catch (error) {
              console.warn("Error en verificación periódica:", error);
            }
          }, 30000); // 30 segundos

          return;
        }

        // Si la conexión falló o se cerró, detenemos el polling
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed" ||
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "closed"
        ) {
          console.log("Conexión fallida o cerrada, deteniendo monitoreo");
          if (statusPollingRef.current) {
            clearInterval(statusPollingRef.current);
            statusPollingRef.current = null;
          }
          return;
        }

        // Verificamos el estado normalmente
        try {
          const status = await checkRoomStatus(roomId);
          console.log("Estado de la sala:", status);
        } catch (error) {
          console.warn("Error al verificar estado:", error);
        }
      };

      // Primera verificación inmediata
      checkStatus();

      // Configuramos verificaciones periódicas
      statusPollingRef.current = setInterval(checkStatus, initialInterval);

      // Devolvemos función de limpieza
      return () => {
        if (statusPollingRef.current) {
          clearInterval(statusPollingRef.current);
          statusPollingRef.current = null;
        }
      };
    },
    []
  );

  const checkRoomStatus = async (roomId: string) => {
    try {
      const status = await checkStatus(roomId);
      console.log("Estado de la sala:", status);
    } catch (error) {
      console.warn("Error al verificar estado de la sala:", error);
    }
  };

  const createConnection = async (iceServers?: RTCIceServer[]) => {
    try {
      setErrorMessage(null);
      const pc = createPeerConnection(iceServers);

      // Monitoreo detallado de estados
      pc.onconnectionstatechange = () => {
        console.log(`Estado de conexión: ${pc.connectionState}`);
        setConnectionState(pc.connectionState);

        if (pc.connectionState === "connected") {
          setConnected(true);
        } else if (
          ["disconnected", "failed", "closed"].includes(pc.connectionState)
        ) {
          setConnected(false);

          if (pc.connectionState === "disconnected") {
            console.log("Intentando recuperar conexión...");
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`Estado de conexión ICE: ${pc.iceConnectionState}`);
        setIceConnectionState(pc.iceConnectionState);

        if (pc.iceConnectionState === "failed") {
          console.log("Reintentando conexión ICE...");
          pc.restartIce?.();
        }
      };

      const channel = pc.createDataChannel("fileTransfer", {
        ordered: true,
        maxRetransmits: 3,
      });

      // Escuchar mensajes entrantes
      channel.onmessage = (e) => {
        console.log("📩 Mensaje recibido:", e.data);
      };

      channel.onopen = () => {
        console.log("📢 Canal de datos abierto");
        setConnected(true);
      };

      channel.onclose = () => {
        console.log("🚫 Canal de datos cerrado");
        setConnected(false);
      };

      channel.onerror = (e) => {
        console.warn("Error en canal de datos:", e);
        setErrorMessage("Error en canal de datos");
      };

      // 👇 Primero generamos la oferta y asignamos localDescription
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
      console.log("Oferta creada:", offer);

      // 🔒 Creamos la sala (ya tenemos offer)
      const { roomId } = await createRoom(offer);
      setRoomId(roomId);
      console.log(`Sala creada: ${roomId}`);

      // 🧊 Configurar manejo de candidatos ICE
      const cleanupIce = await handleIceCandidates(pc, roomId, true);
      cleanupFunctions.current.push(cleanupIce);

      // 🔄 Configurar polling para escuchar respuesta
      const cleanupPolling = await pollForAnswer(roomId, pc);
      cleanupFunctions.current.push(cleanupPolling);

      // ⏱️ Iniciar monitoreo de estado adaptativo
      const cleanupStatus = startStatusPolling(roomId, pc);
      cleanupFunctions.current.push(cleanupStatus);

      // 🧠 Guardamos en store global
      setDataChannel(channel);
      setConnection({ pc, dataChannel: channel, roomId });
    } catch (error) {
      console.warn("Error al crear conexión:", error);
      setErrorMessage(`Error al crear conexión: ${error}`);
    }
  };

  const joinConnection = async (
    roomId: string,
    iceServers?: RTCIceServer[]
  ) => {
    try {
      setErrorMessage(null);
      console.log(`🔌 Intentando unirse a sala: ${roomId}`);
      const { offer } = await fetchOffer(roomId);
      console.log("Oferta recibida:", offer);

      const pc = createPeerConnection(iceServers);

      // Monitorear el estado de conexión
      pc.onconnectionstatechange = () => {
        console.log(`Estado de conexión: ${pc.connectionState}`);
        setConnectionState(pc.connectionState);

        if (pc.connectionState === "connected") {
          setConnected(true);
        } else if (
          ["disconnected", "failed", "closed"].includes(pc.connectionState)
        ) {
          setConnected(false);

          if (pc.connectionState === "disconnected") {
            console.log("Intentando recuperar conexión (callee)...");
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`Estado de conexión ICE: ${pc.iceConnectionState}`);
        setIceConnectionState(pc.iceConnectionState);

        if (pc.iceConnectionState === "failed") {
          console.log("Reintentando conexión ICE (callee)...");
          pc.restartIce?.();
        }
      };

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        console.log(`Canal de datos recibido: ${channel.label}`);

        channel.onmessage = (e) => {
          console.log("📩 Mensaje recibido:", e.data);
        };

        channel.onopen = () => {
          console.log("📢 Canal de datos abierto (callee)");
          setConnected(true);
        };

        channel.onclose = () => {
          console.log("🚫 Canal de datos cerrado (callee)");
          setConnected(false);
        };

        channel.onerror = (e) => {
          console.warn("Error en canal de datos (callee):", e);
          setErrorMessage("Error en canal de datos (callee)");
        };

        setDataChannel(channel);
      };

      // Establecer la oferta remota
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log("Oferta remota establecida");

      // Crear respuesta
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("Respuesta creada:", answer);

      // Guardar respuesta en Firebase
      await saveAnswer(roomId, answer);
      console.log("Respuesta guardada en Firebase");

      // Configurar manejo de candidatos ICE
      const cleanupIce = await handleIceCandidates(pc, roomId, false);
      cleanupFunctions.current.push(cleanupIce);

      // Iniciar monitoreo de estado adaptativo
      const cleanupStatus = startStatusPolling(roomId, pc);
      cleanupFunctions.current.push(cleanupStatus);

      setRoomId(roomId);
      setConnection({ pc, dataChannel: null, roomId });
    } catch (error) {
      console.warn("Error al unirse a la sala:", error);
      setErrorMessage(`Error al unirse a la sala: ${error}`);
    }
  };

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
