"use client";

import { FileTransfer } from "@/store/main";
import { formatBytes } from "@/utils/webrtcHelpers";
import {
  Box,
  Button,
  Circle,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { CheckCircle, Download, File as FileIcon } from "lucide-react";

interface FileMessageProps {
  file: FileTransfer;
  notifyDownload: (fileId: string) => void;
}

export default function FileMessage({
  file,
  notifyDownload,
}: FileMessageProps) {
  const handleDownload = () => {
    if (!file.blob) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    // Notify peer that file has been downloaded
    if (!file.isOwn) {
      notifyDownload(file.id);
    }
  };

  const getStatusInfo = () => {
    switch (file.status) {
      case "queued":
        return {
          icon: <Spinner size="xs" color="fg.muted" />,
          text: "Queued...",
          color: "fg.muted",
        };
      case "sending":
        return {
          icon: <Spinner size="xs" color="fg.muted" />,
          text: `Sending (${Math.round(file.progress)}%)`,
          color: "fg.muted",
        };
      case "sent":
        return {
          icon: <Icon as={CheckCircle} color="green.solid" />,
          text: "Sent",
          color: "fg.muted",
        };
      case "downloaded-by-peer":
        return {
          icon: <Icon as={Download} color="fg.muted" />,
          text: "Downloaded by peer",
          color: "fg.muted",
        };
      case "receiving":
        return {
          icon: <Spinner size="xs" color="fg.muted" />,
          text: `Receiving (${Math.round(file.progress)}%)`,
          color: "fg.muted",
        };
      case "received":
        return {
          icon: <Icon as={CheckCircle} color="green.solid" />,
          text: "Received",
          color: "fg.muted",
        };
      case "downloaded-by-you":
        return {
          icon: <Icon as={CheckCircle} color="green.solid" />,
          text: "Downloaded",
          color: "fg.muted",
        };
      default:
        return { text: file.status, color: "fg.muted" };
    }
  };

  const { icon, text, color } = getStatusInfo();
  const isDownloadable = file.status === "received" && !file.isOwn;
  const showProgress = ["sending", "receiving"].includes(file.status);

  return (
    <VStack
      gap={2}
      p={3}
      bg={file.isOwn ? "gray.emphasized" : "bg.muted"}
      rounded="lg"
      w="full"
      border="1px"
      borderColor="border.subtle"
      align="stretch"
    >
      <HStack gap={3} w="full">
        <Circle size="40px" bg={file.isOwn ? "gray.muted" : "bg.emphasized"}>
          <Icon as={FileIcon} color="fg.muted" />
        </Circle>
        <VStack align="start" gap={0} flex={1}>
          <Text fontSize="sm" fontWeight="medium" color="fg">
            {file.name}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {formatBytes(file.size)}
          </Text>
        </VStack>
        <HStack>
          {icon}
          <Text fontSize="xs" color={color}>
            {text}
          </Text>
        </HStack>
      </HStack>

      {showProgress && (
        <Box w="full" bg="border" rounded="full" h="4px">
          <Box
            bg="gray.emphasized"
            h="4px"
            w={`${file.progress}%`}
            rounded="full"
          />
        </Box>
      )}

      {isDownloadable && (
        <HStack justify="flex-end">
          <Button
            size="sm"
            variant="solid"
            bg="green.solid"
            color="green.contrast"
            onClick={handleDownload}
            _hover={{ bg: "green.emphasized" }}
          >
            <HStack>
              <Icon as={Download} boxSize="14px" />
              <Text>Download</Text>
            </HStack>
          </Button>
        </HStack>
      )}
    </VStack>
  );
}
