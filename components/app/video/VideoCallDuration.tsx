"use client";

import { useStore } from "@/store/main";
import { Box, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export function VideoCallDuration() {
  const { isVideoCallActive, callStartTime } = useStore();

  const [currentTime, setCurrentTime] = useState(new Date());

  // Update timer every second
  useEffect(() => {
    if (!isVideoCallActive) return;

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [isVideoCallActive]);

  const formatCallDuration = () => {
    if (!callStartTime) return "00:00";

    const duration = Math.floor(
      (currentTime.getTime() - callStartTime.getTime()) / 1000
    );
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <Box
      position="absolute"
      top={4}
      left={4}
      bg="blackAlpha.600"
      color="white"
      px={3}
      py={2}
      rounded="lg"
      backdropFilter="blur(10px)"
    >
      <Text fontSize="sm" fontWeight="medium">
        {formatCallDuration()}
      </Text>
    </Box>
  );
}
