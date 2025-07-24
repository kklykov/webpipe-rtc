"use client";

import { useWebRTC } from "@/hooks/useWebRTC";
import { FileTransfer, useStore } from "@/store/main";
import { getFileTypeIcon } from "@/utils/getFileTypeIcon";
import { getStatusInfo } from "@/utils/getStatusInfo";
import { formatBytes } from "@/utils/webrtcHelpers";
import { Box, Button, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

export function FilesSection() {
  const transfers = useStore((s) => s.transfers);
  const { notifyDownload } = useWebRTC();
  const [, setUpdateTrigger] = useState(0);

  // Update component every 10 seconds to refresh relative time displays
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateTrigger((prev) => prev + 1);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

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

  if (transfers.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted">
        No files transferred
      </Text>
    );
  }

  return (
    <VStack
      w="full"
      gap={3}
      align="stretch"
      flex={1}
      height="max-content"
      overflowY="auto"
    >
      {[...transfers]
        .reverse() // Most recent first
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
                  as={getFileTypeIcon({
                    file: transfer.file,
                    fileName: transfer.name,
                  })}
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
                    <Icon as={Download} boxSize="16px" mr={1} />
                    Download file
                  </Button>
                )}
              </VStack>
            </VStack>
          );
        })}
    </VStack>
  );
}
