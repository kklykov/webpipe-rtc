"use client";

import { Circle, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { Circle as CircleIcon } from "lucide-react";

interface ChatHeaderProps {
  roomId: string | null;
  connectionState: string;
  peerName: string | null;
  userName: string;
}

export default function ChatHeader({
  roomId,
  connectionState,
  peerName,
  userName,
}: ChatHeaderProps) {
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
    <HStack
      px={6}
      py={3}
      bg="bg.muted"
      justify="space-between"
      position="sticky"
      top={0}
      zIndex={100}
      borderBottom="1px solid"
      borderColor="border"
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
  );
}
