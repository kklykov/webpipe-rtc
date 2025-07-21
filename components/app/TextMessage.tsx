"use client";

import { Box, Text } from "@chakra-ui/react";

interface TextMessageProps {
  text: string;
  timestamp: Date;
  isOwn: boolean;
}

export default function TextMessage({
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
      border={isOwn ? "none" : "1px"}
      borderColor="border"
    >
      <Text lineHeight="1.4">{text}</Text>
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
}
