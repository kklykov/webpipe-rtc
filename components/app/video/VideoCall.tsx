"use client";

import { useWebRTC } from "@/hooks/useWebRTC";
import { useStore } from "@/store/main";
import {
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { VideoCallDuration } from "./VideoCallDuration";

export function VideoCall() {
  const {
    localStream,
    remoteStream,
    isVideoCallActive,
    isLocalVideoEnabled,
    isLocalAudioEnabled,
    isRemoteVideoEnabled,
  } = useStore();

  const { endVideoCall, toggleLocalAudio, toggleLocalVideo } = useWebRTC();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Set up local video stream
  useEffect(() => {
    console.log("🎥 Local stream effect:", {
      hasLocalStream: !!localStream,
      hasVideoRef: !!localVideoRef.current,
      streamId: localStream?.id,
      tracks: localStream
        ?.getTracks()
        .map((t) => ({ kind: t.kind, enabled: t.enabled })),
    });

    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      console.log("✅ Local video stream assigned");
    }
  }, [localStream]);

  // Set up remote video stream
  useEffect(() => {
    console.log("📺 Remote stream effect:", {
      hasRemoteStream: !!remoteStream,
      hasVideoRef: !!remoteVideoRef.current,
      streamId: remoteStream?.id,
      tracks: remoteStream
        ?.getTracks()
        .map((t) => ({ kind: t.kind, enabled: t.enabled })),
    });

    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      console.log("✅ Remote video stream assigned");
    }
  }, [remoteStream]);

  if (!isVideoCallActive) {
    return null;
  }

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="black"
      zIndex={1000}
      display="flex"
      flexDirection="column"
    >
      {/* Video Area */}
      <Flex flex={1} position="relative">
        {/* Remote Video (Main) */}
        <Box flex={1} position="relative" bg="gray.900">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <Flex
              h="100%"
              align="center"
              justify="center"
              direction="column"
              color="white"
              gap={4}
            >
              <Icon as={Video} boxSize="48px" opacity={0.5} />
              <Text opacity={0.7}>Waiting for peer video...</Text>
            </Flex>
          )}

          {/* Remote Video Overlay - Show if muted */}
          {!isRemoteVideoEnabled && remoteStream && (
            <Flex
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              bg="gray.800"
              align="center"
              justify="center"
              color="white"
            >
              <VStack gap={2}>
                <Icon as={VideoOff} boxSize="48px" />
                <Text>Video turned off</Text>
              </VStack>
            </Flex>
          )}
        </Box>

        {/* Local Video (Picture-in-Picture) */}
        <Box
          position="absolute"
          top={4}
          right={4}
          w="240px"
          h="180px"
          bg="gray.800"
          rounded="lg"
          overflow="hidden"
          border="2px solid"
          borderColor="white"
        >
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)", // Mirror effect
              }}
            />
          ) : (
            <Flex h="100%" align="center" justify="center" color="white">
              <Icon as={Video} boxSize="24px" opacity={0.5} />
            </Flex>
          )}

          {/* Local Video Overlay - Show if muted */}
          {!isLocalVideoEnabled && localStream && (
            <Flex
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              bg="gray.700"
              align="center"
              justify="center"
              color="white"
            >
              <Icon as={VideoOff} boxSize="24px" />
            </Flex>
          )}
        </Box>
      </Flex>

      {/* Call Info */}
      <VideoCallDuration />

      {/* Controls */}
      <Flex
        justify="center"
        align="center"
        p={6}
        bg="blackAlpha.800"
        backdropFilter="blur(10px)"
      >
        <HStack gap={4}>
          {/* Mute Audio */}
          <IconButton
            size="lg"
            rounded="full"
            colorScheme={isLocalAudioEnabled ? "gray" : "red"}
            onClick={toggleLocalAudio}
            aria-label={isLocalAudioEnabled ? "Mute audio" : "Unmute audio"}
          >
            <Icon as={isLocalAudioEnabled ? Mic : MicOff} boxSize="20px" />
          </IconButton>

          {/* Toggle Video */}
          <IconButton
            size="lg"
            rounded="full"
            colorScheme={isLocalVideoEnabled ? "gray" : "red"}
            onClick={toggleLocalVideo}
            aria-label={
              isLocalVideoEnabled ? "Turn off video" : "Turn on video"
            }
          >
            <Icon as={isLocalVideoEnabled ? Video : VideoOff} boxSize="20px" />
          </IconButton>

          {/* End Call */}
          <IconButton
            size="lg"
            rounded="full"
            colorScheme="red"
            onClick={endVideoCall}
            aria-label="End call"
          >
            <Icon as={PhoneOff} boxSize="20px" />
          </IconButton>
        </HStack>
      </Flex>
    </Box>
  );
}
