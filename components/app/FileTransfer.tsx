"use client";

import { useWebRTC } from "@/hooks/useWebRTC";
import { FileTransfer as FileTransferData } from "@/store/main";
import { formatBytes } from "@/utils/webrtc-helpers";
import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import {
  CheckCircle,
  Download,
  File as FileIcon,
  RotateCw,
} from "lucide-react";

// Component for a single file item in the list
const FileItem = ({ transfer }: { transfer: FileTransferData }) => {
  const { notifyDownload } = useWebRTC();

  const handleDownload = () => {
    if (!transfer.blob) return;
    const url = URL.createObjectURL(transfer.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = transfer.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    // Notify peer that file has been downloaded
    if (!transfer.isOwn) {
      notifyDownload(transfer.id);
    }
  };

  const getStatusIcon = () => {
    switch (transfer.status) {
      case "queued":
      case "sending":
      case "receiving":
        return <RotateCw size={16} color="gray" />;
      case "sent":
      case "received":
      case "downloaded-by-you":
        return <CheckCircle size={16} color="green" />;
      case "downloaded-by-peer":
        return <Download size={16} color="blue" />;
      default:
        return null;
    }
  };

  const isDownloadable = transfer.status === "received" && !transfer.isOwn;
  const showProgress = ["sending", "receiving"].includes(transfer.status);

  return (
    <VStack
      w="full"
      p={3}
      bg="white"
      rounded="lg"
      border="1px solid"
      borderColor="gray.200"
      align="start"
      gap={2}
    >
      <HStack w="full" justify="space-between">
        <HStack gap={3} overflow="hidden">
          <FileIcon size={20} color="gray" />
          <VStack align="start" gap={0}>
            <Text fontSize="sm" fontWeight="medium">
              {transfer.name}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {formatBytes(transfer.size)}
            </Text>
          </VStack>
        </HStack>
        <Box>{getStatusIcon()}</Box>
      </HStack>

      {showProgress && (
        <Box w="full" bg="gray.200" rounded="full" h="4px">
          <Box
            bg="blue.500"
            h="4px"
            w={`${transfer.progress}%`}
            rounded="full"
          />
        </Box>
      )}

      {isDownloadable && (
        <Button
          size="xs"
          colorScheme="green"
          onClick={handleDownload}
          alignSelf="flex-end"
        >
          <Download size={12} />
        </Button>
      )}
    </VStack>
  );
};
