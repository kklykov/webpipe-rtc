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
import { seedConfig } from "@/config/uniqueNames";
import { createPeerConnection } from "@/config/webrtc";
import { FileTransfer, useStore } from "@/store/main";
import {
  createInterval,
  DATA_CHANNEL_CONFIG,
  isConnected,
  isFailed,
  logConnection,
  POLLING_INTERVALS,
} from "@/utils/webrtcHelpers";
import { useCallback, useEffect, useRef } from "react";
import { uniqueNamesGenerator } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";

const CHUNK_SIZE = 64 * 1024; // 64KB

type ControlMessage =
  | {
      type: "start";
      payload: Omit<
        FileTransfer,
        "file" | "blob" | "isOwn" | "timestamp" | "lastStatusChange"
      >;
    }
  | { type: "end"; payload: { fileId: string } }
  | { type: "chat"; payload: string }
  | { type: "download-ack"; payload: { fileId: string } }
  | { type: "peer-name"; payload: { name: string } };

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
  const store = useStore();
  const {
    dataChannel,
    setConnection,
    setConnected,
    setConnectionState,
    setIceConnectionState,
    setErrorMessage,
    setRoomId,
    addMessage,
    addTransfer,
    updateTransfer,
    setCurrentReceivingFileId,
    setPeerName,
  } = store;

  const cleanupFunctions = useRef<(() => void)[]>([]);
  const receivedChunks = useRef<ArrayBuffer[]>([]);
  const isSending = useRef(false);

  useEffect(() => {
    return () => {
      cleanupFunctions.current.forEach((cleanup) => cleanup?.());
      cleanupFunctions.current = [];
    };
  }, []);

  const handleControlMessage = (data: string) => {
    try {
      const message: ControlMessage = JSON.parse(data);
      switch (message.type) {
        case "start":
          addTransfer({
            ...message.payload,
            isOwn: false,
            status: "receiving",
          });
          setCurrentReceivingFileId(message.payload.id);
          break;
        case "end":
          const { transfers, currentReceivingFileId } = useStore.getState();
          const transfer = transfers.find(
            (t) => t.id === currentReceivingFileId
          );
          if (!transfer) return;

          const fileBlob = new Blob(receivedChunks.current, {
            type: transfer.type,
          });
          updateTransfer(transfer.id, {
            status: "received",
            blob: fileBlob,
            progress: 100,
          });
          receivedChunks.current = [];
          setCurrentReceivingFileId(null);
          break;
        case "download-ack":
          updateTransfer(message.payload.fileId, {
            status: "downloaded-by-peer",
          });
          break;
        case "chat":
          addMessage({
            id: Date.now().toString(),
            text: message.payload,
            isOwn: false,
            timestamp: new Date(),
          });
          break;
        case "peer-name":
          setPeerName(message.payload.name);
          break;
      }
    } catch {
      // Mensaje de chat sin formato JSON (compatibilidad)
      addMessage({
        id: Date.now().toString(),
        text: data,
        isOwn: false,
        timestamp: new Date(),
      });
    }
  };

  const setupDataChannelEvents = (channel: RTCDataChannel) => {
    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        handleControlMessage(event.data);
      } else {
        receivedChunks.current.push(event.data);
        const { transfers, currentReceivingFileId } = useStore.getState();
        const transfer = transfers.find((t) => t.id === currentReceivingFileId);
        if (!transfer) return;

        const receivedSize = receivedChunks.current.reduce(
          (acc, c) => acc + c.byteLength,
          0
        );
        const progress = (receivedSize / transfer.size) * 100;
        updateTransfer(transfer.id, { progress });
      }
    };
    channel.onopen = () => {
      console.log("📢 Canal de datos abierto");
      setConnected(true);

      // Send a ping to notify the channel is ready for peer name exchange
      // This will be handled by the component's useEffect
      setTimeout(() => {
        // Small delay to ensure everything is ready
        console.log("🔔 Canal listo para intercambio de nombres");
      }, 100);
    };
    channel.onclose = () => {
      console.log("🚫 Canal de datos cerrado");
      setConnected(false);
    };
    channel.onerror = (e) => {
      console.warn("❌ Error en canal de datos:", e);
      setErrorMessage("Error en canal de datos");
    };
    return channel;
  };

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

      // Generar roomId legible usando seedConfig con reintentos
      let roomId: string = "";
      const maxRetries = 10;
      let retryCount = 0;

      while (retryCount < maxRetries) {
        roomId = uniqueNamesGenerator(seedConfig);
        try {
          await createRoom(offer, roomId);
          setRoomId(roomId);
          console.log(`🏠 Sala creada: ${roomId}`);
          break; // Success - exit loop
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            error.message?.includes("already exists")
          ) {
            retryCount++;
            console.log(
              `⚠️ Room ${roomId} ya existe, intentando con nuevo ID (${retryCount}/${maxRetries})`
            );
            if (retryCount >= maxRetries) {
              throw new Error(
                `No se pudo crear room después de ${maxRetries} intentos`
              );
            }
            // Continue loop to retry with new ID
          } else {
            // Different error - throw immediately (exits loop)
            console.error("❌ Error inesperado al crear room:", error);
            throw error;
          }
        }
      }

      // IMPORTANTE: Configurar manejo de ICE DESPUÉS de crear la sala pero ANTES de otros polling
      const cleanupIce = await setupIceCandidateHandling(pc, roomId, true);

      // Configurar polling para respuesta
      const cleanupAnswer = await listenForAnswer(pc, roomId);

      // Configurar monitoreo de estado al final
      const cleanupStatus = setupStatusMonitoring(roomId, pc);

      cleanupFunctions.current.push(cleanupIce, cleanupAnswer, cleanupStatus);

      // Actualizar estado al final
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
        const channel = setupDataChannelEvents(event.channel);
        // Al recibir el canal, la conexión se actualiza con el canal de datos
        setConnection({ pc, dataChannel: channel, roomId });
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
      // Inicialmente, el callee no tiene el dataChannel hasta que lo recibe
      setConnection({ pc, dataChannel: null, roomId });

      console.log("🎯 Configuración de callee completada");
    } catch (error) {
      console.warn("❌ Error al unirse a la sala:", error);
      setErrorMessage(`Error al unirse a la sala: ${error}`);
    }
  };

  // Enviar mensaje a través del canal de datos
  const sendMessage = (msg: string) => {
    if (dataChannel?.readyState === "open") {
      const message: ControlMessage = { type: "chat", payload: msg };
      dataChannel.send(JSON.stringify(message));
      console.log("📤 Mensaje de chat enviado:", msg);
    } else {
      console.warn("⚠️ Canal no está abierto para enviar mensaje de chat");
    }
  };

  const _sendFile = async (fileId: string) => {
    if (dataChannel?.readyState !== "open") {
      setErrorMessage("La conexión no está lista para enviar archivos.");
      return;
    }

    const transfer = store.transfers.find((t) => t.id === fileId);
    if (!transfer || !transfer.file) return;

    updateTransfer(fileId, { status: "sending" });

    const startMessage: ControlMessage = {
      type: "start",
      payload: {
        id: transfer.id,
        name: transfer.name,
        size: transfer.size,
        type: transfer.type,
        status: "receiving", // El estado inicial para el receptor
        progress: 0,
      },
    };
    dataChannel.send(JSON.stringify(startMessage));

    const arrayBuffer = await transfer.file.arrayBuffer();
    let offset = 0;
    while (offset < arrayBuffer.byteLength) {
      // Esperar a que el buffer del canal de datos se vacíe un poco
      if (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
        await new Promise((resolve) => {
          const listener = () => {
            dataChannel.removeEventListener("bufferedamountlow", listener);
            resolve(undefined);
          };
          dataChannel.addEventListener("bufferedamountlow", listener);
        });
      }

      const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
      dataChannel.send(chunk);
      offset += chunk.byteLength;

      const progress = (offset / arrayBuffer.byteLength) * 100;
      updateTransfer(fileId, { progress });
    }

    const endMessage: ControlMessage = { type: "end", payload: { fileId } };
    dataChannel.send(JSON.stringify(endMessage));

    updateTransfer(fileId, { status: "sent", progress: 100 });
    console.log("✅ Archivo enviado exitosamente");
  };

  const sendSingleFile = async (fileId: string) => {
    if (isSending.current) return;
    isSending.current = true;
    await _sendFile(fileId);
    isSending.current = false;
  };

  const processSendQueue = async () => {
    if (isSending.current) return;

    const filesToProcess = useStore
      .getState()
      .transfers.filter((t) => t.isOwn && t.status === "queued");
    if (filesToProcess.length === 0) return;

    isSending.current = true;
    for (const transfer of filesToProcess) {
      await _sendFile(transfer.id);
    }
    isSending.current = false;
  };

  const addFilesToQueue = (files: FileList) => {
    for (const file of files) {
      const transfer: Omit<FileTransfer, "timestamp"> = {
        id: uuidv4(),
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "queued",
        lastStatusChange: new Date(),
        progress: 0,
        isOwn: true,
      };
      addTransfer(transfer);
    }
  };

  const notifyDownload = (fileId: string) => {
    if (dataChannel?.readyState === "open") {
      const message: ControlMessage = {
        type: "download-ack",
        payload: { fileId },
      };
      dataChannel.send(JSON.stringify(message));
      updateTransfer(fileId, { status: "downloaded-by-you" });
    }
  };

  const sendPeerName = useCallback(
    (name: string, retryCount = 0) => {
      if (dataChannel?.readyState === "open") {
        const message: ControlMessage = {
          type: "peer-name",
          payload: { name },
        };
        dataChannel.send(JSON.stringify(message));
        console.log("📤 Nombre del peer enviado:", name);
      } else if (retryCount < 3) {
        console.warn(
          `⚠️ Canal no está abierto, reintentando en 500ms (intento ${
            retryCount + 1
          }/3)`
        );
        setTimeout(() => sendPeerName(name, retryCount + 1), 500);
      } else {
        console.error(
          "❌ No se pudo enviar el nombre del peer después de 3 intentos"
        );
      }
    },
    [dataChannel]
  );

  return {
    ...store,
    createConnection,
    joinConnection,
    sendMessage,
    processSendQueue,
    addFilesToQueue,
    notifyDownload,
    sendSingleFile,
    sendPeerName,
  };
}
