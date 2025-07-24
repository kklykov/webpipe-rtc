"use client";

import { Box, Text } from "@chakra-ui/react";
import { memo } from "react";

interface TextMessageProps {
  text: string;
  timestamp: Date;
  isOwn: boolean;
}

const TextMessage = memo(function TextMessage({
  text,
  timestamp,
  isOwn,
}: TextMessageProps) {
  return (
    <Box
      bg={isOwn ? "bg.subtle" : ""}
      color={isOwn ? "fg" : "fg"}
      px={4}
      py={3}
      rounded="xl"
      outline="1px solid"
      outlineColor={isOwn ? "transparent" : "border"}
    >
      <Text lineHeight="1.4" whiteSpace="pre-wrap" wordBreak="break-word">
        {text}
      </Text>
      <Text
        fontSize="xs"
        color="fg.muted"
        mt={1}
        textAlign="right"
        opacity={0.7}
      >
        {timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </Box>
  );
});

export default TextMessage;
