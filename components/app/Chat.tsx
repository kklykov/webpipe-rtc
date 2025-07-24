"use client";

import { useWebRTC } from "@/hooks/useWebRTC";
import { useStore } from "@/store/main";
import { Box, Flex } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import ChatHeader from "./ChatHeader";
import ChatHistory from "./ChatHistory";
import ChatInput from "./ChatInput";

export default function Chat() {
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const userName = useStore((s) => s.userName);

  const {
    connected,
    connectionState,
    sendPeerName,
    sendMessage,
    addMessage,
    addFilesToQueue,
    roomId,
    peerName,
    notifyDownload,
  } = useWebRTC();

  useEffect(() => {
    sendPeerName(userName);
  }, [userName, sendPeerName]);

  // Global drag detection
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) {
        setIsGlobalDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Only hide if we're leaving the window completely
      if (!e.relatedTarget) {
        setIsGlobalDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsGlobalDragging(false);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  }, []);

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

  return (
    <Flex h="100vh" direction="column" position="relative" overflow="auto">
      <ChatHeader
        roomId={roomId}
        connectionState={connectionState}
        peerName={peerName}
        userName={userName}
      />

      {/* History Area */}
      <Box
        flex={1}
        bg="bg.muted"
        overflow="hidden"
        height="100%"
        minHeight="max-content"
        px={4}
      >
        <ChatHistory
          userName={userName}
          peerName={peerName}
          notifyDownload={notifyDownload}
        />
      </Box>

      <ChatInput
        connected={connected}
        onSendMessage={handleSendMessage}
        isGlobalDragging={isGlobalDragging}
      />
    </Flex>
  );
}
