"use client";

import { useCombinedHistory } from "@/store/main";
import { Box, Circle, Flex, Stack, Text, VStack } from "@chakra-ui/react";
import { FileInputIcon, PaperclipIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import FileMessage from "./FileMessage";
import TextMessage from "./TextMessage";

interface ChatHistoryProps {
  userName: string;
  peerName: string | null;
  notifyDownload: (fileId: string) => void;
}

export default function ChatHistory({
  userName,
  peerName,
  notifyDownload,
}: ChatHistoryProps) {
  const history = useCombinedHistory();
  const historyEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [history]);

  return (
    <VStack
      w="full"
      h={history.length === 0 ? "100%" : "auto"}
      maxW="800px"
      flex={1}
      gap={5}
      py={4}
      align="stretch"
      margin="0 auto"
    >
      {history.length === 0 ? (
        <Stack
          flex={1}
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="fg.muted"
          padding={4}
          textAlign="center"
          gap={8}
        >
          <Text fontSize="lg">No messages yet. Start a conversation!</Text>
          <Text
            fontSize="sm"
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexWrap="wrap"
            gap={2}
            lineHeight="1.6"
          >
            <FileInputIcon />
            <Text as="span" whiteSpace="nowrap">
              Drag files to the input or use the
            </Text>
            <PaperclipIcon />
            <Text as="span" whiteSpace="nowrap">
              button
            </Text>
          </Text>
        </Stack>
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
