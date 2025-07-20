"use client";

import Chat from "@/components/app/Chat";
import ConnectionManager from "@/components/app/ConnectionManager";
import { nameConfig } from "@/config/uniqueNames";
import { useWebRTC } from "@/hooks/useWebRTC";
import { FileTransfer, useStore } from "@/store/main";
import { formatBytes } from "@/utils/webrtcHelpers";
import {
  Box,
  Button,
  Circle,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { CheckCircle, Download, File as FileIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { uniqueNamesGenerator } from "unique-names-generator";

// Files section component for the sidebar
const FilesSection = () => {
  const transfers = useStore((s) => s.transfers);
  const { notifyDownload } = useWebRTC();

  const handleDownload = (transfer: FileTransfer) => {
    if (!transfer.blob) return;
    const url = URL.createObjectURL(transfer.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = transfer.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    if (!transfer.isOwn) {
      notifyDownload(transfer.id);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "hace un momento";
    if (minutes < 60) return `hace ${minutes}m`;
    if (hours < 24) return `hace ${hours}h`;
    if (days < 7) return `hace ${days}d`;

    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  const getStatusInfo = (transfer: FileTransfer) => {
    const timeText = formatDate(transfer.lastStatusChange);
    const direction = transfer.isOwn ? "Enviado" : "Recibido";

    switch (transfer.status) {
      case "queued":
        return { text: "En cola...", color: "fg.muted", icon: null };
      case "sending":
        return { text: "Enviando...", color: "blue.solid", icon: null };
      case "sent":
        return {
          text: `Enviado ${timeText}`,
          color: "green.solid",
          icon: CheckCircle,
        };
      case "receiving":
        return { text: "Recibiendo...", color: "blue.solid", icon: null };
      case "received":
        return {
          text: `Recibido ${timeText}`,
          color: "orange.solid",
          icon: Download,
        };
      case "downloaded-by-peer":
        return {
          text: `Descargado ${timeText}`,
          color: "green.solid",
          icon: CheckCircle,
        };
      case "downloaded-by-you":
        return {
          text: `Descargado ${timeText}`,
          color: "green.solid",
          icon: CheckCircle,
        };
      default:
        return {
          text: `${direction} ${timeText}`,
          color: "fg.muted",
          icon: null,
        };
    }
  };

  if (transfers.length === 0) {
    return (
      <Text fontSize="xs" color="fg.muted">
        No hay archivos transferidos
      </Text>
    );
  }

  return (
    <VStack w="full" gap={3} align="stretch" maxH="400px" overflowY="auto">
      {[...transfers]
        .reverse() // Most recent first
        .slice(0, 8) // Show up to 8 files
        .map((transfer) => {
          const statusInfo = getStatusInfo(transfer);
          return (
            <VStack
              key={transfer.id}
              p={3}
              bg="bg.muted"
              rounded="lg"
              border="1px"
              borderColor="border"
              gap={2}
              align="stretch"
            >
              {/* File info header */}
              <HStack gap={2} align="start">
                <Icon
                  as={FileIcon}
                  boxSize="16px"
                  color="fg.muted"
                  flexShrink={0}
                  mt="1px"
                />
                <VStack align="start" gap={0} flex={1} minW={0}>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color="fg"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                    w="full"
                  >
                    {transfer.name}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {formatBytes(transfer.size)}
                  </Text>
                </VStack>
              </HStack>

              {/* Transfer details */}
              <VStack gap={2} align="stretch">
                <HStack justify="space-between" align="center">
                  <HStack gap={1}>
                    {statusInfo.icon && (
                      <Icon
                        as={statusInfo.icon}
                        boxSize="10px"
                        color={statusInfo.color}
                      />
                    )}
                    <Text
                      fontSize="xs"
                      color={statusInfo.color}
                      fontWeight="medium"
                    >
                      {statusInfo.text}
                    </Text>
                  </HStack>

                  {/* Progress for active transfers */}
                  {["sending", "receiving"].includes(transfer.status) && (
                    <Text fontSize="xs" color={statusInfo.color}>
                      {Math.round(transfer.progress)}%
                    </Text>
                  )}
                </HStack>

                {/* Progress bar for active transfers */}
                {["sending", "receiving"].includes(transfer.status) && (
                  <Box w="full" bg="border" rounded="full" h="2px">
                    <Box
                      bg={statusInfo.color}
                      h="2px"
                      w={`${transfer.progress}%`}
                      rounded="full"
                      transition="width 0.3s ease"
                    />
                  </Box>
                )}

                {/* Download button */}
                {transfer.status === "received" && !transfer.isOwn && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleDownload(transfer)}
                    borderColor="green.solid"
                    color="green.solid"
                    _hover={{ bg: "green.subtle" }}
                    w="full"
                    mt={1}
                  >
                    <Icon as={Download} boxSize="10px" mr={1} />
                    Descargar archivo
                  </Button>
                )}
              </VStack>
            </VStack>
          );
        })}
    </VStack>
  );
};

export default function Home() {
  const { connected, joinConnection } = useWebRTC();

  // Generate random username once per session
  const userName = useMemo(() => {
    return uniqueNamesGenerator(nameConfig);
  }, []);

  // Auto-join room from URL query parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");

    if (roomParam && !connected) {
      console.log(`🔗 Auto-joining room from URL: ${roomParam}`);
      joinConnection(roomParam);

      // Clean up URL without triggering a page reload
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url.toString());
    }
  }, [connected, joinConnection]);

  // Show connection manager when not connected
  if (!connected) {
    return <ConnectionManager />;
  }

  // Show sidebar + chat layout when connected
  return (
    <HStack h="100vh" gap={0} bg="bg">
      {/* Sidebar - Only visible on tablets and up */}
      <Box
        w="280px"
        h="100vh"
        bg="bg.subtle"
        borderRight="1px"
        borderColor="border"
        display={{ base: "none", md: "flex" }}
        flexDirection="column"
      >
        {/* User Profile Section */}
        <VStack
          p={6}
          align="start"
          gap={4}
          borderBottom="1px"
          borderColor="border"
        >
          <HStack gap={3}>
            <Circle
              size="40px"
              bg="gray.solid"
              color="gray.contrast"
              fontSize="sm"
              fontWeight="bold"
            >
              {userName
                .split(" ")
                .map((word) => word[0])
                .join("")
                .toUpperCase()}
            </Circle>
            <VStack align="start" gap={0}>
              <Text fontSize="md" fontWeight="semibold" color="fg">
                {userName}
              </Text>
              <Text fontSize="sm" color="fg.muted">
                Usuario
              </Text>
            </VStack>
          </HStack>
        </VStack>

        {/* Files Section */}
        <VStack flex={1} p={4} align="start" gap={3}>
          <Text fontSize="sm" color="fg" fontWeight="semibold">
            Archivos transferidos
          </Text>
          <FilesSection />
        </VStack>
      </Box>

      {/* Chat Section - Full width on mobile, remaining space on desktop */}
      <Box flex={1} h="100vh" bg="bg">
        <Chat userName={userName} />
      </Box>
    </HStack>
  );
}
