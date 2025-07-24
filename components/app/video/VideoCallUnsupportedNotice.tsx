"use client";

import { useWebRTC } from "@/hooks/useWebRTC";
import { useStore } from "@/store/main";
import {
  Alert,
  Box,
  CloseButton,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { AlertTriangle, Shield } from "lucide-react";
import { useState } from "react";

export function VideoCallUnsupportedNotice() {
  const [showUnsupportedNotice, setShowUnsupportedNotice] = useState(true);
  const { connected } = useStore();
  const { isVideoCallSupported } = useWebRTC();

  // Only show when connected but video calls are not supported
  if (!connected || isVideoCallSupported()) {
    return null;
  }

  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const isHTTPS = window.location.protocol === "https:";

  if (!showUnsupportedNotice) {
    return null;
  }

  return (
    <Alert.Root
      p={4}
      mb={4}
      maxW="800px"
      mx="auto"
      variant="surface"
      status="warning"
    >
      <VStack align="start" gap={3} w="full">
        <HStack w="full" justify="space-between">
          <Box display="flex" alignItems="center" gap={2} flex={1}>
            <Icon as={AlertTriangle} boxSize="20px" color="orange.solid" />
            <Text fontSize="sm" fontWeight="semibold" color="fg">
              Video calls not available
            </Text>
          </Box>
          <CloseButton
            pos="relative"
            top="-2"
            insetEnd="-2"
            size="sm"
            onClick={() => setShowUnsupportedNotice(false)}
          />
        </HStack>
        <VStack align="start" gap={2} fontSize="sm" color="fg.muted">
          {!isHTTPS && !isLocalhost && (
            <Box display="flex" alignItems="start" gap={2}>
              <Icon as={Shield} boxSize="16px" mt="2px" flexShrink={0} />
              <Text>
                Video calls require HTTPS for security. Please access the app
                via{" "}
                <Text
                  as="span"
                  fontFamily="mono"
                  bg="bg.emphasized"
                  px={1}
                  rounded="sm"
                >
                  https://
                </Text>{" "}
                or use{" "}
                <Text
                  as="span"
                  fontFamily="mono"
                  bg="bg.emphasized"
                  px={1}
                  rounded="sm"
                >
                  localhost
                </Text>{" "}
                for development.
              </Text>
            </Box>
          )}

          {!navigator.mediaDevices && (
            <Text>
              Your browser does not support media devices. Please use a modern
              browser like Chrome, Firefox, or Safari.
            </Text>
          )}

          <Text opacity={0.8}>
            File sharing and chat will continue to work normally.
          </Text>
        </VStack>
      </VStack>
    </Alert.Root>
  );
}
