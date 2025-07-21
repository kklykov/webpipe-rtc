"use client";

import { useCombinedHistory } from "@/store/main";
import { Box, Circle, Flex, Text, VStack } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import FileMessage from "./FileMessage";
import TextMessage from "./TextMessage";

interface ChatHistoryProps {
  userName: string;
  peerName: string | null;
  isDragOver: boolean;
  notifyDownload: (fileId: string) => void;
}

export default function ChatHistory({
  userName,
  peerName,
  isDragOver,
  notifyDownload,
}: ChatHistoryProps) {
  const history = useCombinedHistory();
  const historyEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [history]);

  return (
    <VStack w="full" maxW="800px" flex={1} p={4} gap={4} align="stretch">
      {isDragOver && (
        <Flex
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="gray.subtle"
          border="2px dashed"
          borderColor="gray.emphasized"
          align="center"
          justify="center"
          zIndex={10}
          rounded="lg"
          m={2}
        >
          <VStack>
            <Text fontSize="xl" color="gray.emphasized" fontWeight="bold">
              📁 Drop files here
            </Text>
            <Text color="gray.emphasized">To send them instantly</Text>
          </VStack>
        </Flex>
      )}

      {history.length === 0 ? (
        <Flex flex={1} align="center" justify="center" color="fg.muted">
          <VStack>
            <Text>No messages yet. Start a conversation!</Text>
            <Text fontSize="sm">💡 Drag files here or use the 📎 button</Text>
          </VStack>
        </Flex>
      ) : (
        history.map((item) => (
          <Flex
            key={`${item.type}-${item.id}`}
            justify={item.isOwn ? "flex-end" : "flex-start"}
            gap={3}
            align="start"
          >
            {!item.isOwn && (
              <Box position="sticky" top="0px" paddingTop={2}>
                <Circle
                  size="32px"
                  bg="gray.muted"
                  color="gray.fg"
                  fontSize="xs"
                  fontWeight="bold"
                  flexShrink={0}
                >
                  {peerName
                    ? peerName
                        .split(" ")
                        .map((word) => word[0])
                        .join("")
                        .toUpperCase()
                    : "P"}
                </Circle>
              </Box>
            )}

            <Box maxW={{ base: "85%", md: "70%" }}>
              {item.type === "message" ? (
                <TextMessage
                  text={item.text}
                  timestamp={item.timestamp}
                  isOwn={item.isOwn}
                />
              ) : (
                <FileMessage file={item} notifyDownload={notifyDownload} />
              )}
            </Box>

            {item.isOwn && (
              <Box position="sticky" top="0px" paddingTop={2}>
                <Circle
                  size="32px"
                  bg="gray.emphasized"
                  color="fg"
                  fontSize="xs"
                  fontWeight="bold"
                  flexShrink={0}
                >
                  {userName
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .toUpperCase()}
                </Circle>
              </Box>
            )}
          </Flex>
        ))
      )}
      <div ref={historyEndRef} />
    </VStack>
  );
}
