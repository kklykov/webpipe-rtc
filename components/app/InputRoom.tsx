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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        setLoading(true);
        const res = await getIceServers();

        console.log("🧊 Ice servers:", res);
        setIceServers(res);
      } catch (error) {
        console.warn("Error al obtener servidores ICE:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchIceServers();
  }, []);

  const handleCreateRoom = () => {
    createConnection(iceServers);
  };

  const handleJoinRoom = () => {
    if (inputId) {
      joinConnection(inputId, iceServers);
    }
  };

  return (
    <Stack>
      <Text>Room ID: {roomId || "No hay sala creada"}</Text>

      {errorMessage && <Text color="red.500">{errorMessage}</Text>}

      <Text fontSize="sm">
        Estado de conexión: {connectionState} | Estado ICE: {iceConnectionState}
      </Text>

      <Button
        disabled={iceServers.length === 0}
        colorScheme={connected ? "green" : "blue"}
        loading={loading}
        onClick={handleCreateRoom}
      >
        {connected ? "Conectado" : "Crear Sala"}
      </Button>

      <HStack>
        <Input
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          placeholder="Room ID"
        />
        <Button
          disabled={iceServers.length === 0}
          loading={loading}
          onClick={handleJoinRoom}
        >
          Unirse a Sala
        </Button>
      </HStack>

      <Button
        disabled={!connected}
        onClick={() => sendMessage("Hola desde cliente!")}
      >
        Enviar mensaje
      </Button>
    </Stack>
  );
}
