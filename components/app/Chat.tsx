"use client";

import { useWebRTC } from "@/hooks/useWebRTC";
import { Box, Button, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import { Send } from "lucide-react";
import { useState } from "react";
import ChatHeader from "./ChatHeader";
import ChatHistory from "./ChatHistory";
import ChatInput from "./ChatInput";

interface ChatProps {
  userName: string;
}

export default function Chat({ userName }: ChatProps) {
  const [isDragOver, setIsDragOver] = useState(false);

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
    notifyDownload,
  } = useWebRTC();

  const queuedFiles = transfers.filter((t) => t.isOwn && t.status === "queued");
  const shouldShowButton =
    queuedFiles.length > 0 && (!connected || connectionState !== "connected");

  const handleSendMessage = (message: string, files: File[]) => {
    // Send text message if provided
    if (message.trim()) {
      try {
        sendMessage(message);
        addMessage({
          id: Date.now().toString(),
          text: message,
          isOwn: true,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }

    // Add files to queue if provided
    if (files.length > 0) {
      // Convert File[] to FileList-like object
      const fileList = Object.assign(files, {
        item: (index: number) => files[index] || null,
      }) as FileList;

      addFilesToQueue(fileList);
      // addFilesToQueue already handles processing the queue automatically
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && connected) {
      // Files dropped without text should auto-send
      addFilesToQueue(e.dataTransfer.files);
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

  return (
    <Flex h="100vh" direction="column">
      <ChatHeader
        roomId={roomId}
        connectionState={connectionState}
        peerName={peerName}
        userName={userName}
      />

      {/* Send Queued Files Button */}
      {shouldShowButton && (
        <Box p={3} bg="orange.subtle" borderBottom="1px" borderColor="border">
          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="orange.emphasized">
              {queuedFiles.length} archivo{queuedFiles.length !== 1 ? "s" : ""}{" "}
              en cola
            </Text>
            <Button
              size="sm"
              variant="solid"
              colorPalette="orange"
              onClick={() => processSendQueue()}
              disabled={!connected}
            >
              <Icon as={Send} boxSize="12px" mr={1} />
              Enviar archivos
            </Button>
          </HStack>
        </Box>
      )}

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
        <ChatHistory
          userName={userName}
          peerName={peerName}
          isDragOver={isDragOver}
          notifyDownload={notifyDownload}
        />
      </Flex>

      <ChatInput connected={connected} onSendMessage={handleSendMessage} />
    </Flex>
  );
}
