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
  | { type: "peer-name"; payload: { name: string } }
  | { type: "video-call-request"; payload: Record<string, never> }
  | { type: "video-call-accept"; payload: Record<string, never> }
  | { type: "video-call-reject"; payload: Record<string, never> }
  | { type: "video-call-end"; payload: Record<string, never> }
  | { type: "video-mute"; payload: { audio: boolean; video: boolean } }
  | { type: "video-offer"; payload: { offer: RTCSessionDescriptionInit } }
  | { type: "video-answer"; payload: { answer: RTCSessionDescriptionInit } };

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
    addTransfers,
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

  // Handle video call acceptance for the initiator
  const handleVideoCallAcceptForInitiator = useCallback(async () => {
    try {
      console.log("📞 Handling video call acceptance for initiator");

      const currentState = useStore.getState();

      if (!currentState.pc) {
        console.warn("⚠️ No peer connection available for initiator");
        return;
      }

      if (!currentState.localStream) {
        console.warn("⚠️ No local stream available for initiator");
        return;
      }

      // Setup ontrack handler if not already set
      if (!currentState.pc.ontrack) {
        currentState.pc.ontrack = (event) => {
          console.log(
            "📹 Remote track received (initiator):",
            event.track.kind
          );
          console.log("📹 Track details:", {
            trackId: event.track.id,
            enabled: event.track.enabled,
            readyState: event.track.readyState,
            streamCount: event.streams.length,
            streamIds: event.streams.map((s) => s.id),
          });

          const [remoteStream] = event.streams;
          console.log("📹 Setting remote stream (initiator):", {
            streamId: remoteStream.id,
            trackCount: remoteStream.getTracks().length,
            tracks: remoteStream
              .getTracks()
              .map((t) => ({ kind: t.kind, enabled: t.enabled })),
          });

          currentState.setRemoteStream(remoteStream);
        };
      }

      // Check if tracks are already added
      const currentSenders = currentState.pc.getSenders();
      const hasVideoTrack = currentSenders.some(
        (sender) => sender.track && sender.track.kind === "video"
      );
      const hasAudioTrack = currentSenders.some(
        (sender) => sender.track && sender.track.kind === "audio"
      );

      console.log("📊 Current tracks status (initiator):", {
        hasVideoTrack,
        hasAudioTrack,
        totalSenders: currentSenders.length,
      });

      // Add tracks if not already present
      if (!hasVideoTrack || !hasAudioTrack) {
        currentState.localStream.getTracks().forEach((track) => {
          const trackExists = currentSenders.some(
            (sender) => sender.track === track
          );
          if (!trackExists) {
            console.log(`📤 Adding ${track.kind} track (initiator):`, track.id);
            currentState.pc!.addTrack(track, currentState.localStream!);
          }
        });

        console.log(
          "📊 Peer connection state after adding tracks (initiator):",
          {
            connectionState: currentState.pc.connectionState,
            iceConnectionState: currentState.pc.iceConnectionState,
            signalingState: currentState.pc.signalingState,
            localTracks: currentState.pc.getSenders().length,
            remoteTracks: currentState.pc.getReceivers().length,
          }
        );

        // Trigger delayed renegotiation after adding tracks
        setTimeout(() => {
          const pc = useStore.getState().pc as RTCPeerConnection & {
            _triggerDelayedRenegotiation?: () => void;
          };
          if (pc && pc._triggerDelayedRenegotiation) {
            console.log("🚀 Activating delayed renegotiation for initiator");
            pc._triggerDelayedRenegotiation();
          }
        }, 2000); // Wait 2 seconds for both sides to stabilize
      }
    } catch (error) {
      console.error(
        "❌ Error handling video call acceptance for initiator:",
        error
      );
    }
  }, []);

  // Handle incoming video offer during renegotiation
  const handleVideoOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      console.log("📥 Received video offer for renegotiation");

      // Get current peer connection from store state
      const currentState = useStore.getState();
      const pc = currentState.pc;

      if (!pc) {
        console.error("❌ No peer connection available for video offer");
        console.log("🔍 Current store state:", {
          hasPC: !!currentState.pc,
          connected: currentState.connected,
          connectionState: currentState.connectionState,
          iceConnectionState: currentState.iceConnectionState,
        });
        return;
      }

      console.log("✅ Peer connection found, processing video offer");

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log("✅ Video offer set as remote description");

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("✅ Video answer created and set as local description");

      // Log current data channel state before attempting to send
      console.log("📊 Data channel state before sending answer:", {
        hasDataChannel: !!dataChannel,
        readyState: dataChannel?.readyState,
        bufferedAmount: dataChannel?.bufferedAmount,
        maxRetransmits: dataChannel?.maxRetransmits,
        ordered: dataChannel?.ordered,
      });

      // Send answer back through data channel
      if (dataChannel?.readyState === "open") {
        const message: ControlMessage = {
          type: "video-answer",
          payload: { answer },
        };
        dataChannel.send(JSON.stringify(message));
        console.log("📤 Video answer sent back");
      } else {
        console.warn(
          "⚠️ Data channel not ready, will retry sending video answer"
        );

        // Retry sending the answer with exponential backoff
        const sendAnswerWithRetry = (attempt = 1, maxAttempts = 5) => {
          setTimeout(() => {
            const currentDataChannel = useStore.getState().dataChannel;

            if (currentDataChannel?.readyState === "open") {
              const message: ControlMessage = {
                type: "video-answer",
                payload: { answer },
              };
              currentDataChannel.send(JSON.stringify(message));
              console.log(`📤 Video answer sent back (attempt ${attempt})`);
            } else if (attempt < maxAttempts) {
              console.warn(
                `⚠️ Data channel still not ready, retrying... (${attempt}/${maxAttempts})`
              );
              sendAnswerWithRetry(attempt + 1, maxAttempts);
            } else {
              console.error(
                "❌ Failed to send video answer after maximum attempts"
              );
            }
          }, attempt * 200); // 200ms, 400ms, 600ms, 800ms, 1000ms
        };

        sendAnswerWithRetry();
      }
    } catch (error) {
      console.error("❌ Error handling video offer:", error);
    }
  };

  // Handle incoming video answer during renegotiation
  const handleVideoAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      console.log("📥 Received video answer for renegotiation");

      // Get current peer connection from store state
      const currentState = useStore.getState();
      const pc = currentState.pc;

      if (!pc) {
        console.error("❌ No peer connection available for video answer");
        console.log("🔍 Current store state:", {
          hasPC: !!currentState.pc,
          connected: currentState.connected,
          connectionState: currentState.connectionState,
          iceConnectionState: currentState.iceConnectionState,
        });
        return;
      }

      console.log("✅ Peer connection found, processing video answer");

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(
        "✅ Video answer set as remote description - renegotiation complete"
      );
    } catch (error) {
      console.error("❌ Error handling video answer:", error);
    }
  };

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
        case "video-call-request":
          store.setIncomingCall(true);
          break;
        case "video-call-accept":
          store.setOutgoingCall(false);
          store.setVideoCallActive(true);
          store.setCallStartTime(new Date());

          // The initiator needs to add their video tracks when call is accepted
          handleVideoCallAcceptForInitiator();
          break;
        case "video-call-reject":
          store.setOutgoingCall(false);
          store.setIncomingCall(false);
          break;
        case "video-call-end":
          store.setVideoCallActive(false);
          store.setIncomingCall(false);
          store.setOutgoingCall(false);
          store.setCallStartTime(null);
          // Clean up streams
          if (store.localStream) {
            store.localStream.getTracks().forEach((track) => track.stop());
            store.setLocalStream(null);
          }
          if (store.remoteStream) {
            store.setRemoteStream(null);
          }
          break;
        case "video-mute":
          store.setRemoteAudioEnabled(message.payload.audio);
          store.setRemoteVideoEnabled(message.payload.video);
          break;
        case "video-offer":
          // Handle incoming video offer for renegotiation
          handleVideoOffer(message.payload.offer);
          break;
        case "video-answer":
          // Handle incoming video answer for renegotiation
          handleVideoAnswer(message.payload.answer);
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
  const createConnection = async (
    iceServers?: RTCIceServer[],
    withVideo = false
  ) => {
    try {
      setErrorMessage(null);
      const pc = createPeerConnection(iceServers);

      // IMPORTANTE: Configurar eventos ANTES de crear la oferta
      setupConnectionEvents(pc);

      // Setup media streams if video call is requested
      if (withVideo) {
        try {
          // Check browser support first
          checkMediaDevicesSupport();

          const localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

          store.setLocalStream(localStream);

          // Add tracks to peer connection
          localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
          });

          // Handle remote stream
          pc.ontrack = (event) => {
            console.log("📹 Remote track received:", event.track.kind);
            const [remoteStream] = event.streams;
            store.setRemoteStream(remoteStream);
          };
        } catch (mediaError) {
          console.warn("❌ Error accessing media devices:", mediaError);

          // Provide user-friendly error messages
          let errorMessage = "Could not access camera/microphone";
          if (mediaError instanceof Error) {
            if (
              mediaError.message.includes("HTTPS") ||
              mediaError.message.includes("secure")
            ) {
              errorMessage =
                "Video calls require HTTPS. Please use https://localhost or deploy with SSL.";
            } else if (mediaError.name === "NotAllowedError") {
              errorMessage =
                "Camera/microphone access denied. Please allow permissions and try again.";
            }
          }

          setErrorMessage(errorMessage);
          throw mediaError;
        }
      }

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
          console.log(`🏠 Room created: ${roomId}`);
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
                `Could not create room after ${maxRetries} attempts`
              );
            }
            // Continue loop to retry with new ID
          } else {
            // Different error - throw immediately (exits loop)
            console.error("❌ Unexpected error creating room:", error);
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
      setErrorMessage(`Error creating connection: ${error}`);
    }
  };

  // Unirse a una conexión existente (callee)
  const joinConnection = async (
    roomId: string,
    iceServers?: RTCIceServer[],
    withVideo = false
  ) => {
    try {
      setErrorMessage(null);
      console.log(`🔌 Attempting to join room: ${roomId}`);

      const { offer } = await fetchOffer(roomId);
      const pc = createPeerConnection(iceServers);

      // IMPORTANTE: Configurar eventos ANTES de establecer descripciones
      setupConnectionEvents(pc);

      // Setup media streams if video call is requested
      if (withVideo) {
        try {
          // Check browser support first
          checkMediaDevicesSupport();

          const localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

          store.setLocalStream(localStream);

          // Add tracks to peer connection
          localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
          });

          // Handle remote stream
          pc.ontrack = (event) => {
            console.log("📹 Remote track received:", event.track.kind);
            const [remoteStream] = event.streams;
            store.setRemoteStream(remoteStream);
          };
        } catch (mediaError) {
          console.warn("❌ Error accessing media devices:", mediaError);
          // Continue without video but log the error
        }
      }

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
      setErrorMessage(`Error joining room: ${error}`);
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

  const _sendFile = async (fileId: string, transferData?: FileTransfer) => {
    if (dataChannel?.readyState !== "open") {
      setErrorMessage("Connection is not ready to send files.");
      throw new Error("Connection is not ready to send files.");
    }

    // Use provided transfer data or fallback to store lookup
    let transfer = transferData;
    if (!transfer) {
      transfer = store.transfers.find((t) => t.id === fileId);
    }

    if (!transfer || !transfer.file) {
      console.error(`❌ Transfer not found: ${fileId}`, {
        transferProvided: !!transferData,
        storeTransfers: store.transfers.length,
        storeTransferIds: store.transfers.map((t) => t.id),
      });
      throw new Error("Transfer or file not found");
    }

    try {
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
        // Verificar que el canal sigue abierto
        if (dataChannel.readyState !== "open") {
          throw new Error("Data channel closed during file transfer");
        }

        // Esperar a que el buffer del canal de datos se vacíe un poco
        if (
          dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold
        ) {
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
      console.log("✅ File sent successfully");
    } catch (error) {
      console.error("❌ Error sending file:", error);
      updateTransfer(fileId, { status: "queued" }); // Reset to queued for retry
      throw error; // Re-throw to be handled by caller
    }
  };

  const sendSingleFile = async (fileId: string) => {
    if (isSending.current) {
      console.log("⏳ Ya hay un envío en progreso, saltando...");
      return;
    }

    console.log(`📤 Enviando archivo individual: ${fileId}`);
    isSending.current = true;

    try {
      await _sendFile(fileId);
    } catch (error) {
      console.error(`❌ Error enviando archivo individual ${fileId}:`, error);
    } finally {
      // Always reset the flag, even if there was an error
      isSending.current = false;
      console.log("✅ Envío individual completado");
    }
  };

  const processSendQueue = async (specificTransfers?: Array<FileTransfer>) => {
    if (isSending.current) {
      console.log("⏳ Ya hay un envío en progreso, saltando...");
      return;
    }

    let filesToProcess;

    if (specificTransfers) {
      // Use specific transfers passed as parameter (complete transfer objects)
      console.log(
        "🎯 Procesando transfers específicos:",
        specificTransfers.map((t) => `${t.name} (${t.id})`)
      );
      filesToProcess = specificTransfers;
    } else {
      // Always get the freshest state
      const currentState = useStore.getState();
      filesToProcess = currentState.transfers.filter(
        (t) => t.isOwn && t.status === "queued"
      );

      console.log(
        `🔍 Estado actual: ${currentState.transfers.length} transfers totales`
      );
      console.log(
        `🔍 Archivos propios: ${
          currentState.transfers.filter((t) => t.isOwn).length
        }`
      );
      console.log(`🔍 En cola: ${filesToProcess.length}`);
    }

    if (filesToProcess.length === 0) {
      console.log("📭 No hay archivos en cola para enviar");
      return;
    }

    console.log(
      `🚀 Procesando ${filesToProcess.length} archivos en cola:`,
      filesToProcess.map((t) => `${t.name} (${t.id})`)
    );
    isSending.current = true;

    try {
      for (const transfer of filesToProcess) {
        try {
          console.log(`📤 Enviando: ${transfer.name} (${transfer.id})`);

          // Pass complete transfer object when available
          if (specificTransfers) {
            await _sendFile(transfer.id, transfer);
          } else {
            await _sendFile(transfer.id);
          }
        } catch (error) {
          console.error(`❌ Error enviando archivo ${transfer.name}:`, error);
          // Continue with next file even if one fails
        }
      }
    } finally {
      // Always reset the flag, even if there were errors
      isSending.current = false;
      console.log("✅ Procesamiento de cola completado");
    }
  };

  const addFilesToQueue = (files: FileList) => {
    console.log(`📂 Añadiendo ${files.length} archivos a la cola`);

    // Create all transfers at once to avoid race conditions
    const transfers: Omit<FileTransfer, "timestamp" | "lastStatusChange">[] =
      [];
    for (const file of files) {
      const id = uuidv4();
      transfers.push({
        id: id,
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "queued",
        progress: 0,
        isOwn: true,
      });
      console.log(`📄 Preparado: ${file.name} (${id})`);
    }

    // Add all transfers in a single batch operation
    addTransfers(transfers);

    console.log(
      `📦 Transfers añadidos a la cola:`,
      transfers.map((t) => `${t.name} (${t.id})`)
    );

    // Auto-process aggressively
    console.log(
      `🔍 Estado del canal: ${dataChannel?.readyState || "undefined"}`
    );
    console.log(`🔍 Connected: ${store.connected}`);

    if (dataChannel?.readyState === "open") {
      console.log(
        `📤 Canal abierto - Auto-enviando ${files.length} archivo${
          files.length !== 1 ? "s" : ""
        } directamente`
      );

      // Pass complete transfers directly to avoid race condition
      const transfersToSend = transfers.map(
        (t) =>
          ({
            ...t,
            timestamp: new Date(),
            lastStatusChange: new Date(),
          } as FileTransfer)
      );

      setTimeout(() => {
        console.log("⏰ Ejecutando processSendQueue con transfers específicos");
        processSendQueue(transfersToSend);
      }, 100); // Single timeout with complete transfers
    } else {
      console.log(
        `📋 Canal no listo (${dataChannel?.readyState}), reintentando auto-envío...`
      );

      // Pass complete transfers directly to avoid race condition
      const transfersToSend = transfers.map(
        (t) =>
          ({
            ...t,
            timestamp: new Date(),
            lastStatusChange: new Date(),
          } as FileTransfer)
      );

      // Retry auto-send with longer delays
      let attempts = 0;
      const retryAutoSend = () => {
        attempts++;
        console.log(`🔄 Intento ${attempts} de auto-envío`);

        if (dataChannel?.readyState === "open") {
          console.log(
            `✅ Canal listo en intento ${attempts}, enviando transfers específicos`
          );
          processSendQueue(transfersToSend);
        } else if (attempts < 10) {
          setTimeout(retryAutoSend, attempts * 500);
        } else {
          console.warn("❌ Auto-envío fallido después de múltiples intentos");
        }
      };

      setTimeout(retryAutoSend, 500);
    }
  };

  const notifyDownload = useCallback(
    (fileId: string) => {
      if (dataChannel?.readyState === "open") {
        const message: ControlMessage = {
          type: "download-ack",
          payload: { fileId },
        };
        dataChannel.send(JSON.stringify(message));
        updateTransfer(fileId, { status: "downloaded-by-you" });
      }
    },
    [dataChannel, updateTransfer]
  );

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
      } else if (retryCount === 3) {
        console.error(
          "❌ No se pudo enviar el nombre del peer después de 3 intentos"
        );
      }
    },
    [dataChannel]
  );

  // Helper function to check if getUserMedia is available
  const checkMediaDevicesSupport = () => {
    if (!navigator.mediaDevices) {
      throw new Error(
        "Media devices not supported. Please use HTTPS or localhost."
      );
    }

    if (!navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia not supported in this browser.");
    }

    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      throw new Error(
        "Video calls require HTTPS. Please use https:// or localhost."
      );
    }
  };

  // Function to check if video calls are supported (non-throwing)
  const isVideoCallSupported = useCallback(() => {
    try {
      checkMediaDevicesSupport();
      return true;
    } catch {
      return false;
    }
  }, []);

  // Video call functions
  const startVideoCall = useCallback(async () => {
    if (dataChannel?.readyState !== "open") {
      setErrorMessage("Connection not ready for video call");
      return;
    }

    try {
      // Check browser support first
      checkMediaDevicesSupport();

      // Get user media
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      store.setLocalStream(localStream);
      store.setOutgoingCall(true);

      // Add tracks to existing peer connection and setup renegotiation
      if (store.pc) {
        // Setup remote track handling BEFORE adding tracks
        store.pc.ontrack = (event) => {
          console.log("📹 Remote track received:", event.track.kind);
          console.log("📹 Track details:", {
            trackId: event.track.id,
            enabled: event.track.enabled,
            readyState: event.track.readyState,
            streamCount: event.streams.length,
            streamIds: event.streams.map((s) => s.id),
          });

          const [remoteStream] = event.streams;
          console.log("📹 Setting remote stream:", {
            streamId: remoteStream.id,
            trackCount: remoteStream.getTracks().length,
            tracks: remoteStream
              .getTracks()
              .map((t) => ({ kind: t.kind, enabled: t.enabled })),
          });

          store.setRemoteStream(remoteStream);
        };

        // Add tracks to trigger renegotiation
        localStream.getTracks().forEach((track) => {
          console.log(`📤 Adding ${track.kind} track to peer connection`);
          console.log(`📤 Track details:`, {
            trackId: track.id,
            enabled: track.enabled,
            readyState: track.readyState,
          });
          store.pc!.addTrack(track, localStream);
        });

        console.log("📊 Peer connection state after adding tracks:", {
          connectionState: store.pc.connectionState,
          iceConnectionState: store.pc.iceConnectionState,
          signalingState: store.pc.signalingState,
          localTracks: store.pc.getSenders().length,
          remoteTracks: store.pc.getReceivers().length,
        });

        // Handle automatic renegotiation
        store.pc.onnegotiationneeded = async () => {
          console.log("🔄 Renegotiation needed for video call");
          console.log(
            "⏱️ Waiting for connection to stabilize before renegotiation..."
          );

          // Wait a bit for the data connection to stabilize
          await new Promise((resolve) => setTimeout(resolve, 1000));

          try {
            console.log("🚀 Starting renegotiation process");
            const offer = await store.pc!.createOffer();
            await store.pc!.setLocalDescription(offer);

            // Send offer through data channel for renegotiation
            if (dataChannel?.readyState === "open") {
              const message: ControlMessage = {
                type: "video-offer",
                payload: { offer },
              };
              dataChannel.send(JSON.stringify(message));
              console.log("📤 Video offer sent for renegotiation");
            } else {
              console.warn(
                "⚠️ Data channel not ready, cannot send video offer"
              );
              console.log("📊 Data channel state:", {
                hasDataChannel: !!dataChannel,
                readyState: dataChannel?.readyState,
                connected: useStore.getState().connected,
              });
            }
          } catch (error) {
            console.error("❌ Error during renegotiation:", error);
          }
        };

        // Also setup a delayed renegotiation trigger for after acceptance
        const triggerDelayedRenegotiation = () => {
          console.log("⏰ Triggering delayed renegotiation for video call");
          if (store.pc && store.pc.onnegotiationneeded) {
            // Manually trigger renegotiation if needed
            const senders = store.pc.getSenders();
            const hasVideoSender = senders.some(
              (s) => s.track && s.track.kind === "video"
            );
            const hasAudioSender = senders.some(
              (s) => s.track && s.track.kind === "audio"
            );

            console.log("📊 Checking if renegotiation needed:", {
              hasVideoSender,
              hasAudioSender,
              totalSenders: senders.length,
            });

            if (hasVideoSender && hasAudioSender) {
              console.log(
                "✅ All tracks present, manually triggering renegotiation"
              );
              // Force renegotiation
              const event = new Event("negotiationneeded");
              store.pc.onnegotiationneeded(
                event as Event & { target: RTCPeerConnection }
              );
            }
          }
        };

        // Store the function for later use
        (
          store.pc as RTCPeerConnection & {
            _triggerDelayedRenegotiation?: () => void;
          }
        )._triggerDelayedRenegotiation = triggerDelayedRenegotiation;
      }

      // Send video call request
      const message: ControlMessage = {
        type: "video-call-request",
        payload: {},
      };
      dataChannel.send(JSON.stringify(message));

      console.log("📹 Video call request sent");
    } catch (error) {
      console.error("❌ Error starting video call:", error);

      // Provide user-friendly error messages
      let errorMessage = "Failed to start video call";
      if (error instanceof Error) {
        if (
          error.message.includes("HTTPS") ||
          error.message.includes("secure")
        ) {
          errorMessage =
            "Video calls require HTTPS. Please use https://localhost or deploy with SSL.";
        } else if (error.message.includes("Media devices")) {
          errorMessage =
            "Camera/microphone access not supported in this browser.";
        } else if (error.name === "NotAllowedError") {
          errorMessage =
            "Camera/microphone access denied. Please allow permissions and try again.";
        } else if (error.name === "NotFoundError") {
          errorMessage = "No camera or microphone found.";
        } else if (error.name === "NotSupportedError") {
          errorMessage = "Camera/microphone not supported on this device.";
        }
      }

      setErrorMessage(errorMessage);
      store.setOutgoingCall(false);
    }
  }, [dataChannel, store]);

  const acceptVideoCall = useCallback(async () => {
    try {
      // Check browser support first
      checkMediaDevicesSupport();

      // Get user media
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      store.setLocalStream(localStream);
      store.setIncomingCall(false);
      store.setVideoCallActive(true);
      store.setCallStartTime(new Date());

      // Add tracks to existing peer connection and setup renegotiation
      if (store.pc) {
        // Setup remote track handling BEFORE adding tracks (if not already set)
        if (!store.pc.ontrack) {
          store.pc.ontrack = (event) => {
            console.log(
              "📹 Remote track received (accepter):",
              event.track.kind
            );
            console.log("📹 Track details:", {
              trackId: event.track.id,
              enabled: event.track.enabled,
              readyState: event.track.readyState,
              streamCount: event.streams.length,
              streamIds: event.streams.map((s) => s.id),
            });

            const [remoteStream] = event.streams;
            console.log("📹 Setting remote stream (accepter):", {
              streamId: remoteStream.id,
              trackCount: remoteStream.getTracks().length,
              tracks: remoteStream
                .getTracks()
                .map((t) => ({ kind: t.kind, enabled: t.enabled })),
            });

            store.setRemoteStream(remoteStream);
          };
        }

        // Add tracks to trigger renegotiation
        localStream.getTracks().forEach((track) => {
          console.log(
            `📤 Adding ${track.kind} track to peer connection (accepter)`
          );
          console.log(`📤 Track details:`, {
            trackId: track.id,
            enabled: track.enabled,
            readyState: track.readyState,
          });
          store.pc!.addTrack(track, localStream);
        });

        console.log(
          "📊 Peer connection state after adding tracks (accepter):",
          {
            connectionState: store.pc.connectionState,
            iceConnectionState: store.pc.iceConnectionState,
            signalingState: store.pc.signalingState,
            localTracks: store.pc.getSenders().length,
            remoteTracks: store.pc.getReceivers().length,
          }
        );

        // Don't set up automatic renegotiation here - let the initiator handle it
        // This prevents renegotiation conflicts
        console.log(
          "📝 Skipping automatic renegotiation setup - letting initiator handle it"
        );
      }

      // Send acceptance
      if (dataChannel?.readyState === "open") {
        const message: ControlMessage = {
          type: "video-call-accept",
          payload: {},
        };
        dataChannel.send(JSON.stringify(message));
      }

      console.log("📹 Video call accepted");
    } catch (error) {
      console.error("❌ Error accepting video call:", error);

      // Provide user-friendly error messages
      let errorMessage = "Failed to accept video call";
      if (error instanceof Error) {
        if (
          error.message.includes("HTTPS") ||
          error.message.includes("secure")
        ) {
          errorMessage =
            "Video calls require HTTPS. Please use https://localhost or deploy with SSL.";
        } else if (error.name === "NotAllowedError") {
          errorMessage =
            "Camera/microphone access denied. Please allow permissions and try again.";
        }
      }

      setErrorMessage(errorMessage);
      rejectVideoCall();
    }
  }, [dataChannel, store]);

  const rejectVideoCall = useCallback(() => {
    store.setIncomingCall(false);

    if (dataChannel?.readyState === "open") {
      const message: ControlMessage = {
        type: "video-call-reject",
        payload: {},
      };
      dataChannel.send(JSON.stringify(message));
    }

    console.log("📹 Video call rejected");
  }, [dataChannel, store]);

  const endVideoCall = useCallback(() => {
    // Clean up local stream
    if (store.localStream) {
      store.localStream.getTracks().forEach((track) => track.stop());
      store.setLocalStream(null);
    }

    // Clean up remote stream
    if (store.remoteStream) {
      store.setRemoteStream(null);
    }

    // Update states
    store.setVideoCallActive(false);
    store.setIncomingCall(false);
    store.setOutgoingCall(false);
    store.setCallStartTime(null);

    // Send end call message
    if (dataChannel?.readyState === "open") {
      const message: ControlMessage = {
        type: "video-call-end",
        payload: {},
      };
      dataChannel.send(JSON.stringify(message));
    }

    console.log("📹 Video call ended");
  }, [dataChannel, store]);

  const toggleLocalAudio = useCallback(() => {
    const currentState = useStore.getState();

    if (currentState.localStream) {
      const audioTracks = currentState.localStream.getAudioTracks();
      const newState = !currentState.isLocalAudioEnabled;

      console.log(
        `🎤 Toggling audio: ${currentState.isLocalAudioEnabled} → ${newState}`
      );

      audioTracks.forEach((track) => {
        track.enabled = newState;
        console.log(`🎤 Audio track ${track.id} enabled: ${track.enabled}`);
      });

      // Update store state
      currentState.setLocalAudioEnabled(newState);

      // Notify peer about mute state
      const currentDataChannel = currentState.dataChannel;
      if (currentDataChannel?.readyState === "open") {
        const message: ControlMessage = {
          type: "video-mute",
          payload: {
            audio: newState,
            video: currentState.isLocalVideoEnabled,
          },
        };
        currentDataChannel.send(JSON.stringify(message));
        console.log(
          `📤 Sent mute state to peer: audio=${newState}, video=${currentState.isLocalVideoEnabled}`
        );
      } else {
        console.warn("⚠️ Cannot send mute state - data channel not ready");
      }
    } else {
      console.warn("⚠️ No local stream available for audio toggle");
    }
  }, []);

  const toggleLocalVideo = useCallback(() => {
    const currentState = useStore.getState();

    if (currentState.localStream) {
      const videoTracks = currentState.localStream.getVideoTracks();
      const newState = !currentState.isLocalVideoEnabled;

      console.log(
        `📹 Toggling video: ${currentState.isLocalVideoEnabled} → ${newState}`
      );

      videoTracks.forEach((track) => {
        track.enabled = newState;
        console.log(`📹 Video track ${track.id} enabled: ${track.enabled}`);
      });

      // Update store state
      currentState.setLocalVideoEnabled(newState);

      // Notify peer about mute state
      const currentDataChannel = currentState.dataChannel;
      if (currentDataChannel?.readyState === "open") {
        const message: ControlMessage = {
          type: "video-mute",
          payload: {
            audio: currentState.isLocalAudioEnabled,
            video: newState,
          },
        };
        currentDataChannel.send(JSON.stringify(message));
        console.log(
          `📤 Sent mute state to peer: audio=${currentState.isLocalAudioEnabled}, video=${newState}`
        );
      } else {
        console.warn("⚠️ Cannot send mute state - data channel not ready");
      }
    } else {
      console.warn("⚠️ No local stream available for video toggle");
    }
  }, []);

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

    // Video call functions
    startVideoCall,
    acceptVideoCall,
    rejectVideoCall,
    endVideoCall,
    toggleLocalAudio,
    toggleLocalVideo,
    isVideoCallSupported,
  };
}
