"use client";

import { FileTransfer, useCombinedHistory } from "@/store/main";
import { formatBytes } from "@/utils/webrtcHelpers";
import {
  Box,
  Button,
  Circle,
  Flex,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { CheckCircle, Download, File as FileIcon } from "lucide-react";
import { useEffect, useRef } from "react";

interface ChatHistoryProps {
  userName: string;
  peerName: string | null;
  isDragOver: boolean;
  notifyDownload: (fileId: string) => void;
}

// File message component to be used inside the chat history
const FileMessage = ({
  file,
  notifyDownload,
}: {
  file: FileTransfer;
  notifyDownload: (fileId: string) => void;
}) => {
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
};

export default function ChatHistory({
  userName,
  peerName,
  isDragOver,
  notifyDownload,
}: ChatHistoryProps) {
  const history = useCombinedHistory();
  const historyEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [history]);

  return (
    <VStack w="full" maxW="800px" flex={1} p={4} gap={4} align="stretch">
      {isDragOver && (
        <Flex
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="gray.subtle"
          border="2px dashed"
          borderColor="gray.emphasized"
          align="center"
          justify="center"
          zIndex={10}
          rounded="lg"
          m={2}
        >
          <VStack>
            <Text fontSize="xl" color="gray.emphasized" fontWeight="bold">
              📁 Drop files here
            </Text>
            <Text color="gray.emphasized">To send them instantly</Text>
          </VStack>
        </Flex>
      )}

      {history.length === 0 ? (
        <Flex flex={1} align="center" justify="center" color="fg.muted">
          <VStack>
            <Text>No messages yet. Start a conversation!</Text>
            <Text fontSize="sm">💡 Drag files here or use the 📎 button</Text>
          </VStack>
        </Flex>
      ) : (
        history.map((item) => (
          <Flex
            key={`${item.type}-${item.id}`}
            justify={item.isOwn ? "flex-end" : "flex-start"}
            gap={3}
            align="start"
          >
            {!item.isOwn && (
              <Box position="sticky" top="0px" paddingTop={2}>
                <Circle
                  size="32px"
                  bg="gray.muted"
                  color="gray.fg"
                  fontSize="xs"
                  fontWeight="bold"
                  flexShrink={0}
                >
                  {peerName
                    ? peerName
                        .split(" ")
                        .map((word) => word[0])
                        .join("")
                        .toUpperCase()
                    : "P"}
                </Circle>
              </Box>
            )}

            <Box maxW={{ base: "85%", md: "70%" }}>
              {item.type === "message" ? (
                <Box
                  bg={item.isOwn ? "bg.subtle" : ""}
                  color={item.isOwn ? "fg" : "fg"}
                  px={4}
                  py={3}
                  rounded="xl"
                  border={item.isOwn ? "none" : "1px"}
                  borderColor="border"
                >
                  <Text lineHeight="1.4">{item.text}</Text>
                  <Text
                    fontSize="xs"
                    color="fg.muted"
                    mt={1}
                    textAlign="right"
                    opacity={0.7}
                  >
                    {item.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </Box>
              ) : (
                <FileMessage file={item} notifyDownload={notifyDownload} />
              )}
            </Box>

            {item.isOwn && (
              <Box position="sticky" top="0px" paddingTop={2}>
                <Circle
                  size="32px"
                  bg="gray.emphasized"
                  color="fg"
                  fontSize="xs"
                  fontWeight="bold"
                  flexShrink={0}
                >
                  {userName
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .toUpperCase()}
                </Circle>
              </Box>
            )}
          </Flex>
        ))
      )}
      <div ref={historyEndRef} />
    </VStack>
  );
}
