"use client";

import { getIceServers } from "@/app/actions";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { HousePlugIcon, Share2Icon, WaypointsIcon } from "lucide-react";
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

export default function ConnectionManager() {
  const [inputId, setInputId] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);

  const {
    roomId,
    connected,
    connectionState,
    errorMessage,
    createConnection,
    joinConnection,
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

  const isDisabled = fetchingIce || connected;
  const hasError = errorMessage || iceError;

  return (
    <Box h="100vh" bg="bg" p={4}>
      <Stack gap={4} p={4} maxW="md" mx="auto" h="full" justify="center">
        <HStack justify="center">
          <Share2Icon />
          <Text fontSize="xl" fontWeight="bold" textAlign="center" color="fg">
            WebRTC Connection Manager
          </Text>
        </HStack>

        {/* Room ID Display */}
        {roomId && (
          <Box bg="bg.emphasized" p={4} rounded="lg" shadow="sm">
            <Text fontSize="sm" color="fg.muted" mb={2}>
              Room ID:
            </Text>
            <Text
              fontFamily="mono"
              bg="bg.muted"
              color="fg.onEmphasized"
              px={3}
              py={2}
              rounded="md"
              fontSize="sm"
              fontWeight="bold"
              textAlign="center"
            >
              {roomId}
            </Text>
          </Box>
        )}

        {/* Error Messages */}
        {hasError && (
          <Text color="red.500" fontSize="sm" p={3} bg="bg.muted" rounded="md">
            ⚠️ {errorMessage || iceError}
          </Text>
        )}

        {/* Connection Status */}
        <Box bg="bg.emphasized" p={3} rounded="lg" shadow="sm">
          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Estado:{" "}
            <Text
              as="span"
              color={
                connectionState === "connected"
                  ? "green.500"
                  : connectionState === "connecting"
                  ? "yellow.500"
                  : "red.500"
              }
              fontWeight="medium"
            >
              {connectionState}
            </Text>
          </Text>
        </Box>

        {/* Create Room Button */}
        <Button
          disabled={isDisabled}
          loading={creatingRoom || fetchingIce}
          loadingText={
            fetchingIce ? "Obteniendo servidores..." : "Creando sala..."
          }
          onClick={handleCreateRoom}
          size="lg"
        >
          <HousePlugIcon />
          {connected ? "✅ Conectado" : `Crear Sala`}
        </Button>

        {/* Join Room Section */}
        <HStack>
          <Input
            value={inputId}
            paddingStart={4}
            onChange={(e) => setInputId(e.target.value)}
            placeholder="Ingresa el Room ID"
            disabled={isDisabled}
            onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
          />
          <Box w="100%">
            <Button
              colorScheme="fg.onEmphasized"
              disabled={isDisabled || !inputId.trim()}
              loading={joiningRoom}
              loadingText="Uniéndose..."
              onClick={handleJoinRoom}
              w="100%"
            >
              <WaypointsIcon />
              Unirse
            </Button>
          </Box>
        </HStack>

        {/* Connected Actions */}
        {connected && (
          <Button
            colorScheme="fg.onEmphasized"
            variant="outline"
            onClick={handleDisconnect}
            size="md"
          >
            🔌 Desconectar
          </Button>
        )}

        {/* Loading State */}
        {fetchingIce && (
          <Text fontSize="sm" color="fg.muted" textAlign="center">
            🔄 Configurando servidores ICE...
          </Text>
        )}
      </Stack>
    </Box>
  );
}
