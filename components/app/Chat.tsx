"use client";

import { useWebRTC } from "@/hooks/useWebRTC";
import { FileTransfer, useCombinedHistory } from "@/store/main";
import { formatBytes } from "@/utils/webrtcHelpers";
import {
  Box,
  Button,
  Circle,
  Flex,
  HStack,
  Icon,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  CheckCircle,
  Circle as CircleIcon,
  Download,
  File as FileIcon,
  Send,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ChatProps {
  userName: string;
}

// File message component to be used inside the chat history
const FileMessage = ({ file }: { file: FileTransfer }) => {
  const { notifyDownload } = useWebRTC();

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

export default function Chat({ userName }: ChatProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const history = useCombinedHistory();

  const {
    connected,
    connectionState,
    sendMessage,
    addMessage,
    addFilesToQueue,
    processSendQueue,
    transfers,
    roomId,
    peerName,
    sendPeerName,
    setPeerName,
  } = useWebRTC();

  const scrollToBottom = () => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [history]);

  // Send peer name when connection is established (only once per connection)
  const sentNameRef = useRef(false);

  useEffect(() => {
    if (connected && !sentNameRef.current) {
      // Add a small delay to ensure the data channel is fully ready
      const timeoutId = setTimeout(() => {
        sendPeerName(userName);
        sentNameRef.current = true;
      }, 200); // 200ms delay

      return () => clearTimeout(timeoutId);
    } else if (!connected) {
      sentNameRef.current = false; // Reset when disconnected
      setPeerName(null); // Clear peer name when disconnected
    }
  }, [connected, userName, sendPeerName, setPeerName]);

  // Auto-process send queue when new files are added
  useEffect(() => {
    const queuedFiles = transfers.filter(
      (t) => t.isOwn && t.status === "queued"
    );
    if (queuedFiles.length > 0 && connected) {
      console.log(`📤 Processing ${queuedFiles.length} queued files...`);
      processSendQueue();
    }
  }, [transfers, connected, processSendQueue]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !connected) return;

    try {
      sendMessage(inputMessage);
      addMessage({
        id: Date.now().toString(),
        text: inputMessage,
        isOwn: true,
        timestamp: new Date(),
      });
      setInputMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && connected) {
      addFilesToQueue(e.target.files);
      e.target.value = ""; // Reset input
      // The useEffect will automatically process the queue
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && connected) {
      addFilesToQueue(e.dataTransfer.files);
      // The useEffect will automatically process the queue
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const getStatusInfo = (state: string) => {
    if (state === "connected")
      return {
        color: "green.solid",
        text: peerName ? `Connected to ${peerName}` : "Connected",
        icon: CircleIcon,
      };
    if (["connecting", "checking"].includes(state))
      return {
        color: "yellow.solid",
        text: "Connecting...",
        icon: CircleIcon,
      };
    if (["failed", "closed", "disconnected"].includes(state))
      return {
        color: "red.solid",
        text: "Disconnected",
        icon: CircleIcon,
      };
    return {
      color: "fg.muted",
      text: state,
      icon: CircleIcon,
    };
  };

  const statusInfo = getStatusInfo(connectionState);

  return (
    <Flex h="100vh" direction="column">
      {/* Header */}
      <HStack
        p={4}
        borderBottom="1px"
        borderColor="border"
        bg="bg.muted"
        justify="space-between"
      >
        <VStack align="start" gap={1} flex={1}>
          <Text fontWeight="semibold" color="fg" fontSize="md">
            Room: {roomId || "..."}
          </Text>
          <HStack align="center" gap={2}>
            <Icon as={statusInfo.icon} boxSize="8px" color={statusInfo.color} />
            <Text fontSize="sm" color="fg.muted">
              {statusInfo.text}
            </Text>
          </HStack>
        </VStack>

        {/* User info on mobile */}
        <HStack display={{ base: "flex", md: "none" }} gap={2}>
          <Circle
            size="32px"
            bg="gray.solid"
            color="gray.contrast"
            fontSize="xs"
            fontWeight="bold"
          >
            {userName
              .split(" ")
              .map((word) => word[0])
              .join("")
              .toUpperCase()}
          </Circle>
          <Text fontSize="sm" color="fg" fontWeight="medium">
            {userName}
          </Text>
        </HStack>
      </HStack>

      {/* History Area with Drag & Drop */}
      <Flex
        flex={1}
        justify="center"
        bg={isDragOver ? "gray.subtle" : "bg.muted"}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        overflow="auto"
      >
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
                <Text fontSize="sm">
                  💡 Drag files here or use the 📎 button
                </Text>
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
                    <FileMessage file={item} />
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
      </Flex>

      {/* Input Area */}
      <Flex
        justify="center"
        p={4}
        borderTop="1px"
        borderColor="border"
        bg="bg.muted"
      >
        <VStack w="full" maxW="800px" gap={3}>
          {/* Show manual send button if there are queued files */}
          {transfers.filter((t) => t.isOwn && t.status === "queued").length >
            0 && (
            <HStack justify="center">
              <Button
                size="sm"
                colorScheme="orange"
                onClick={processSendQueue}
                variant="outline"
                borderColor="orange.solid"
                color="orange.solid"
                _hover={{ bg: "orange.subtle" }}
              >
                📤 Send{" "}
                {
                  transfers.filter((t) => t.isOwn && t.status === "queued")
                    .length
                }{" "}
                queued file(s)
              </Button>
            </HStack>
          )}

          <HStack gap={3} w="full">
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              display="none"
              onChange={handleFileChange}
            />
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={connected ? "Type a message..." : "Connecting..."}
              disabled={!connected}
              rounded="lg"
              flex={1}
              bg="bg"
              borderColor="border"
              color="fg"
              pl={4}
              pr={4}
              _placeholder={{ color: "fg.muted" }}
              _focus={{
                borderColor: "gray.emphasized",
                boxShadow: "0 0 0 1px var(--chakra-colors-gray-emphasized)",
              }}
            />
            <Button
              size="md"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!connected}
              title="Select files"
              bg="bg"
              borderColor="border"
              color="fg"
              _hover={{ bg: "bg.muted" }}
              flexShrink={0}
              rounded="lg"
            >
              📎
            </Button>
            <Button
              size="md"
              onClick={handleSendMessage}
              disabled={!connected || !inputMessage.trim()}
              rounded="lg"
              bg="gray.emphasized"
              color="fg"
              _hover={{ bg: "gray.solid" }}
              _disabled={{ opacity: 0.4 }}
              flexShrink={0}
            >
              <Icon as={Send} boxSize="16px" />
            </Button>
          </HStack>
        </VStack>
      </Flex>
    </Flex>
  );
}
