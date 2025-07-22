"use client";

import { formatBytes } from "@/utils/webrtcHelpers";
import {
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Text,
  Textarea,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { File as FileIcon, Paperclip, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

interface ChatInputProps {
  connected: boolean;
  onSendMessage: (message: string, files: File[]) => void;
  isGlobalDragging: boolean;
}

interface FilePreview {
  file: File;
  id: string;
  preview?: string;
}

export default function ChatInput({
  connected,
  onSendMessage,
  isGlobalDragging,
}: ChatInputProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FilePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = (file: File) => file.type.startsWith("image/");

  const addFiles = (files: File[]) => {
    const newFiles: FilePreview[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = `${Date.now()}-${i}`;
      const preview: FilePreview = { file, id };

      if (isImage(file)) {
        preview.preview = URL.createObjectURL(file);
      }

      newFiles.push(preview);
    }
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (connected && acceptedFiles.length > 0) {
      addFiles(acceptedFiles);
    }
  };

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop,
    disabled: !connected,
    noClick: true, // We'll handle click on the paperclip button
    noKeyboard: true,
  });

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      // Clean up preview URLs
      const removed = prev.find((f) => f.id === id);
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return updated;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && connected) {
      addFiles(Array.from(e.target.files));
      e.target.value = ""; // Reset input
    }
  };

  const handleSend = () => {
    if ((!inputMessage.trim() && selectedFiles.length === 0) || !connected)
      return;

    const files = selectedFiles.map((f) => f.file);
    onSendMessage(inputMessage, files);

    // Clean up
    selectedFiles.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setSelectedFiles([]);
    setInputMessage("");

    // Reset textarea height
    setTimeout(() => {
      const textarea = document.querySelector("textarea");
      if (textarea) {
        textarea.style.height = "40px";
      }
    }, 0);
  };

  const hasContent = inputMessage.trim() || selectedFiles.length > 0;

  // Determine if we should show the overlay
  const shouldShowOverlay = connected && (isGlobalDragging || isDragActive);
  const overlayMessage = isDragReject
    ? {
        icon: X,
        title: "File type not supported",
        subtitle: "Please use supported file types",
      }
    : isDragAccept
    ? {
        icon: FileIcon,
        title: "Drop files here",
        subtitle: "Drop files here to add them to the chat",
      }
    : {
        icon: FileIcon,
        title: "Drop files here",
        subtitle: "Drop files here to add them to the chat",
      };

  const overlayColor = isDragReject
    ? { bg: "red.subtle", color: "red.emphasized", border: "red.emphasized" }
    : isDragAccept
    ? {
        bg: "bg.subtle",
        color: "fg.muted",
        border: "fg.muted",
      }
    : {
        bg: "bg",
        color: "bg.emphasized",
        border: "bg.emphasized",
      };

  return (
    <Box position="relative" {...getRootProps()}>
      <input {...getInputProps()} />

      <Flex
        justify="center"
        paddingBottom={4}
        borderTop="1px"
        borderColor="border"
        bg="bg.muted"
      >
        <VStack w="full" maxW="800px" gap={3} position="relative">
          {/* Drag overlay - only covers ChatInput area */}
          {shouldShowOverlay && (
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              zIndex={50}
              bg={overlayColor.bg}
              color={overlayColor.color}
              border="2px dashed"
              borderColor={overlayColor.border}
              rounded="lg"
              display="flex"
              alignItems="center"
              justifyContent="center"
              transition="all 0.16s ease-in-out"
            >
              <HStack gap={2}>
                <Icon as={overlayMessage.icon} boxSize="24px" />
                <Text>{overlayMessage.subtitle}</Text>
              </HStack>
            </Box>
          )}

          {/* Compound Input */}
          <Box
            w="full"
            border="1px"
            borderColor="border"
            rounded="lg"
            bg="bg"
            transition="all 0.16s ease-in-out"
            _focusWithin={{
              borderColor: "gray.emphasized",
              boxShadow: "0 0 0 1px var(--chakra-colors-gray-emphasized)",
            }}
          >
            {/* File Previews */}
            {selectedFiles.length > 0 && (
              <Box
                padding={3}
                paddingBottom={1}
                borderBottom="1px solid"
                borderColor="bg.emphasized"
              >
                <Wrap gap={3}>
                  {selectedFiles.map((filePreview) => (
                    <WrapItem key={filePreview.id}>
                      <Box position="relative">
                        {isImage(filePreview.file) ? (
                          <Box
                            w="80px"
                            h="80px"
                            rounded="md"
                            overflow="hidden"
                            border="1px"
                            borderColor="border.subtle"
                            bg="bg.muted"
                          >
                            <Image
                              src={filePreview.preview}
                              alt={filePreview.file.name}
                              w="100%"
                              h="100%"
                              objectFit="cover"
                            />
                          </Box>
                        ) : (
                          <Flex
                            w="80px"
                            h="80px"
                            rounded="md"
                            border="1px"
                            borderColor="border.subtle"
                            bg="bg.muted"
                            align="center"
                            justify="center"
                            direction="column"
                            gap={1}
                          >
                            <Icon
                              as={FileIcon}
                              boxSize="24px"
                              color="fg.muted"
                            />
                            <Text
                              fontSize="10px"
                              color="fg.muted"
                              textAlign="center"
                              px={1}
                            >
                              {filePreview.file.name.length > 10
                                ? `${filePreview.file.name.substring(0, 10)}...`
                                : filePreview.file.name}
                            </Text>
                          </Flex>
                        )}

                        {/* Remove button */}
                        <IconButton
                          size="xs"
                          position="absolute"
                          top="-8px"
                          right="-8px"
                          bg="gray.emphasized"
                          color="white"
                          rounded="full"
                          onClick={() => removeFile(filePreview.id)}
                          aria-label="Remove file"
                          _hover={{ bg: "red.emphasized" }}
                          minW="24px"
                          h="24px"
                        >
                          <Icon as={X} boxSize="12px" />
                        </IconButton>

                        {/* File size */}
                        <Text
                          fontSize="10px"
                          color="fg.muted"
                          left="0"
                          right="0"
                          textAlign="center"
                        >
                          {formatBytes(filePreview.file.size)}
                        </Text>
                      </Box>
                    </WrapItem>
                  ))}
                </Wrap>
              </Box>
            )}

            {/* Text Input Row */}
            <HStack gap={2} w="full" align="end" padding={3}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />

              <Textarea
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  // Auto-resize textarea
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(
                    target.scrollHeight,
                    120
                  )}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  connected
                    ? "Type a message or drag files here..."
                    : "Connecting..."
                }
                disabled={!connected}
                border="none"
                resize="none"
                minH="56px"
                maxH="120px"
                overflow="hidden"
                _focus={{ boxShadow: "none", border: "none", outline: "none" }}
                flex={1}
                fontSize="sm"
                py={2}
                rows={1}
              />

              <IconButton
                size="sm"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={!connected}
                aria-label="Select files"
                color="fg.muted"
                _hover={{ color: "fg", bg: "bg.muted" }}
                flexShrink={0}
              >
                <Icon as={Paperclip} boxSize="16px" />
              </IconButton>

              <IconButton
                size="sm"
                variant="ghost"
                onClick={handleSend}
                disabled={!connected || !hasContent}
                color="fg.muted"
                _hover={{ color: "fg", bg: "bg.muted" }}
                aria-label="Send message"
                flexShrink={0}
              >
                <Icon as={Send} boxSize="16px" />
              </IconButton>
            </HStack>
          </Box>
        </VStack>
      </Flex>
    </Box>
  );
}
