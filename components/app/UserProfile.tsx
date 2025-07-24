"use client";

import { useStore } from "@/store/main";
import { Circle, HStack, Text, VStack } from "@chakra-ui/react";

export function UserProfile() {
  const userName = useStore((s) => s.userName);

  return (
    <VStack
      p={4}
      pb={2}
      align="start"
      gap={8}
      position="sticky"
      top={0}
      zIndex={1}
      bg="bg"
      _after={{
        content: '""',
        position: "absolute",
        bottom: "-20px",
        left: 0,
        right: 0,
        height: "20px",
        background:
          "linear-gradient(to bottom, var(--chakra-colors-bg) 0%, transparent 100%)",
        pointerEvents: "none",
      }}
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
            User
          </Text>
        </VStack>
      </HStack>

      <Text fontSize="md" color="fg" fontWeight="semibold">
        Transferred files
      </Text>
    </VStack>
  );
}
