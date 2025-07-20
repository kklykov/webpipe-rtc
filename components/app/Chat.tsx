"use client";

import { useWebRTC } from "@/hooks/useWebRTC";
import { Flex } from "@chakra-ui/react";
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
    roomId,
    peerName,
    notifyDownload,
  } = useWebRTC();

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

      // If there's text with the files, don't auto-send files
      const shouldAutoSend = !message.trim();
      addFilesToQueue(fileList, shouldAutoSend);

      // If files are sent with text, process manually
      if (message.trim()) {
        setTimeout(() => {
          processSendQueue();
        }, 100);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && connected) {
      // Files dropped without text should auto-send
      addFilesToQueue(e.dataTransfer.files, true);
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
