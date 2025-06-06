"use client";

import { getIceServers } from "@/app/actions";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

// Custom hook para manejar ICE servers
function useIceServers() {
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        setLoading(true);
        setError("");
        const servers = await getIceServers();
        console.log("🧊 ICE servers obtenidos:", servers);
        setIceServers(servers);
      } catch (err) {
        console.error("❌ Error al obtener servidores ICE:", err);
        setError(
          "No se pudieron obtener los servidores ICE. Usando configuración por defecto."
        );
        // Usar servidores por defecto en caso de error
        setIceServers([
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchIceServers();
  }, []);

  return { iceServers, loading, error };
}

// Componente para mostrar el estado de conexión
function ConnectionStatus({
  connectionState,
  iceConnectionState,
}: {
  connectionState: string;
  iceConnectionState: string;
}) {
  const getStatusColor = (state: string) => {
    switch (state) {
      case "connected":
      case "completed":
        return "green.500";
      case "connecting":
      case "checking":
        return "yellow.500";
      case "failed":
      case "closed":
        return "red.500";
      default:
        return "gray.500";
    }
  };

  return (
    <Text fontSize="sm" color="gray.600">
      Estado de conexión:{" "}
      <Text
        as="span"
        color={getStatusColor(connectionState)}
        fontWeight="medium"
      >
        {connectionState}
      </Text>
      {" | "}
      Estado ICE:{" "}
      <Text
        as="span"
        color={getStatusColor(iceConnectionState)}
        fontWeight="medium"
      >
        {iceConnectionState}
      </Text>
    </Text>
  );
}

export default function InputRoom() {
  const [inputId, setInputId] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);

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

  const { iceServers, loading: fetchingIce, error: iceError } = useIceServers();

  const handleCreateRoom = async () => {
    if (fetchingIce || connected) return;

    try {
      setCreatingRoom(true);
      await createConnection(iceServers);
    } catch (error) {
      console.error("❌ Error al crear sala:", error);
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!inputId.trim() || fetchingIce || connected) return;

    try {
      setJoiningRoom(true);
      await joinConnection(inputId.trim(), iceServers);
    } catch (error) {
      console.error("❌ Error al unirse a sala:", error);
    } finally {
      setJoiningRoom(false);
    }
  };

  const handleDisconnect = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const handleSendTestMessage = () => {
    sendMessage("¡Hola desde el cliente! 👋");
  };

  const isDisabled = fetchingIce || connected;
  const hasError = errorMessage || iceError;

  return (
    <Stack gap={4} p={4} maxW="md" mx="auto">
      <Text fontSize="lg" fontWeight="bold">
        WebRTC Connection Manager
      </Text>

      {/* Room ID Display */}
      <Text>
        <Text as="span" fontWeight="medium">
          Room ID:
        </Text>{" "}
        {roomId ? (
          <Text
            as="span"
            fontFamily="mono"
            bg="gray.800"
            color="green.300"
            px={2}
            py={1}
            rounded="md"
            fontSize="sm"
            fontWeight="bold"
          >
            {roomId}
          </Text>
        ) : (
          <Text as="span" color="gray.500">
            No hay sala creada
          </Text>
        )}
      </Text>

      {/* Error Messages */}
      {hasError && (
        <Text color="red.500" fontSize="sm" p={2} bg="red.50" rounded="md">
          ⚠️ {errorMessage || iceError}
        </Text>
      )}

      {/* Connection Status */}
      <ConnectionStatus
        connectionState={connectionState}
        iceConnectionState={iceConnectionState}
      />

      {/* Create Room Button */}
      <Button
        colorScheme={connected ? "green" : "blue"}
        disabled={isDisabled}
        loading={creatingRoom || fetchingIce}
        loadingText={
          fetchingIce ? "Obteniendo servidores..." : "Creando sala..."
        }
        onClick={handleCreateRoom}
        size="lg"
      >
        {connected ? "✅ Conectado" : "🏠 Crear Sala"}
      </Button>

      {/* Join Room Section */}
      <HStack>
        <Input
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          placeholder="Ingresa el Room ID"
          disabled={isDisabled}
          onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
        />
        <Button
          colorScheme="teal"
          disabled={isDisabled || !inputId.trim()}
          loading={joiningRoom}
          loadingText="Uniéndose..."
          onClick={handleJoinRoom}
          minW="120px"
        >
          🔗 Unirse
        </Button>
      </HStack>

      {/* Connected Actions */}
      {connected && (
        <Stack gap={2}>
          <Button
            colorScheme="purple"
            variant="outline"
            onClick={handleSendTestMessage}
            size="sm"
          >
            📤 Enviar mensaje de prueba
          </Button>

          <Button
            colorScheme="red"
            variant="outline"
            onClick={handleDisconnect}
            size="sm"
          >
            🔌 Desconectar
          </Button>
        </Stack>
      )}

      {/* Loading State */}
      {fetchingIce && (
        <Text fontSize="sm" color="gray.500" textAlign="center">
          🔄 Configurando servidores ICE...
        </Text>
      )}
    </Stack>
  );
}
