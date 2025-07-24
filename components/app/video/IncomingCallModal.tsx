"use client";

import { useWebRTC } from "@/hooks/useWebRTC";
import { useStore } from "@/store/main";
import { Box, Button, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { Phone, PhoneOff, Video } from "lucide-react";

export function IncomingCallModal() {
  const { isIncomingCall, peerName } = useStore();
  const { acceptVideoCall, rejectVideoCall } = useWebRTC();

  if (!isIncomingCall) {
    return null;
  }

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="blackAlpha.800"
      zIndex={999}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box
        bg="bg"
        rounded="xl"
        p={8}
        shadow="2xl"
        border="1px solid"
        borderColor="border"
        maxW="400px"
        w="90%"
      >
        <VStack gap={6} align="center">
          {/* Call Icon */}
          <Box
            bg="blue.subtle"
            rounded="full"
            p={4}
            animation="pulse 2s infinite"
          >
            <Icon as={Video} boxSize="32px" color="blue.solid" />
          </Box>

          {/* Call Info */}
          <VStack gap={2} align="center">
            <Text fontSize="lg" fontWeight="semibold" color="fg">
              Incoming Video Call
            </Text>
            <Text fontSize="md" color="fg.muted">
              {peerName || "Unknown user"} is calling you
            </Text>
          </VStack>

          {/* Action Buttons */}
          <HStack gap={4} w="full">
            {/* Reject */}
            <Button
              size="lg"
              variant="outline"
              colorScheme="red"
              onClick={rejectVideoCall}
              flex={1}
            >
              <Icon as={PhoneOff} mr={2} />
              Decline
            </Button>

            {/* Accept */}
            <Button
              size="lg"
              colorScheme="green"
              onClick={acceptVideoCall}
              flex={1}
            >
              <Icon as={Phone} mr={2} />
              Accept
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
