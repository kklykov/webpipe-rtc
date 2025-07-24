"use client";

import { useWebRTC } from "@/hooks/useWebRTC";
import { useStore } from "@/store/main";
import { Icon, IconButton } from "@chakra-ui/react";
import { Video, VideoOff } from "lucide-react";
import { Tooltip } from "../../ui/tooltip";

export function VideoCallButton() {
  const { connected, isVideoCallActive, isOutgoingCall } = useStore();

  const { startVideoCall, endVideoCall, isVideoCallSupported } = useWebRTC();

  if (!connected || !isVideoCallSupported()) {
    return null;
  }

  const isCallInProgress = isVideoCallActive || isOutgoingCall;

  const handleClick = () => {
    if (isCallInProgress) {
      endVideoCall();
    } else {
      startVideoCall();
    }
  };

  return (
    <Tooltip content={isCallInProgress ? "End video call" : "Start video call"}>
      <IconButton
        size="sm"
        variant={isCallInProgress ? "solid" : "ghost"}
        colorScheme={isCallInProgress ? "red" : "gray"}
        onClick={handleClick}
        aria-label={isCallInProgress ? "End video call" : "Start video call"}
        disabled={isOutgoingCall}
      >
        <Icon as={isCallInProgress ? VideoOff : Video} boxSize="16px" />
      </IconButton>
    </Tooltip>
  );
}
