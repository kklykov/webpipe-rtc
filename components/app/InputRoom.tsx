"use client";

import { getIceServers } from "@/app/actions";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export default function InputRoom() {
  const [inputId, setInputId] = useState("");
  const {
    roomId,
    connected,
    connectionState,
    iceConnectionState,
    errorMessage,
    createConnection,
    joinConnection,
    sendMessage,
  } = useWebRTC();
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [fetchingIce, setFetchingIce] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [localErrorMessage, setLocalErrorMessage] = useState("");

  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        setFetchingIce(true);
        const res = await getIceServers();
        console.log("🧊 Ice servers:", res);
        setIceServers(res);
      } catch (error) {
        console.error("Error al obtener servidores ICE:", error);
        setLocalErrorMessage(
          "No se pudieron obtener los servidores ICE. Intenta de nuevo."
        );
      } finally {
        setFetchingIce(false);
      }
    };
    fetchIceServers();
  }, []);

  const handleCreateRoom = async () => {
    try {
      setCreatingRoom(true);
      await createConnection(iceServers);
    } catch (error) {
      console.error("Error al crear sala:", error);
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    if (inputId.trim()) {
      try {
        setJoiningRoom(true);
        await joinConnection(inputId, iceServers);
      } catch (error) {
        console.error("Error al unirse a sala:", error);
      } finally {
        setJoiningRoom(false);
      }
    }
  };

  const handleDisconnect = () => {
    // Asumimos que podemos desconectar cerrando la conexión
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <Stack>
      <Text>Room ID: {roomId || "No hay sala creada"}</Text>

      {(errorMessage || localErrorMessage) && (
        <Text color="red.500">{errorMessage || localErrorMessage}</Text>
      )}

      <Text fontSize="sm">
        Estado de conexión:{" "}
        <Text
          as="span"
          color={connectionState === "connected" ? "green.500" : "orange.500"}
        >
          {connectionState}
        </Text>{" "}
        | Estado ICE:{" "}
        <Text
          as="span"
          color={
            iceConnectionState === "connected" ? "green.500" : "orange.500"
          }
        >
          {iceConnectionState}
        </Text>
      </Text>

      <Button
        disabled={iceServers.length === 0 || connected || fetchingIce}
        colorScheme={connected ? "green" : "blue"}
        loading={creatingRoom}
        onClick={handleCreateRoom}
      >
        {connected ? "Conectado" : "Crear Sala"}
      </Button>

      <HStack>
        <Input
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          placeholder="Room ID"
          disabled={connected}
        />
        <Button
          disabled={
            iceServers.length === 0 ||
            connected ||
            !inputId.trim() ||
            fetchingIce
          }
          loading={joiningRoom}
          onClick={handleJoinRoom}
        >
          Unirse a Sala
        </Button>
      </HStack>

      {connected && (
        <Button colorScheme="red" onClick={handleDisconnect}>
          Desconectar
        </Button>
      )}

      <Button
        disabled={!connected}
        onClick={() => sendMessage("Hola desde cliente!")}
      >
        Enviar mensaje
      </Button>
    </Stack>
  );
}
