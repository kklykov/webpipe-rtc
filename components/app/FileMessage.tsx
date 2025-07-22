"use client";

import { FileTransfer } from "@/store/main";
import { getFileTypeIcon } from "@/utils/getFileTypeIcon";
import { formatBytes } from "@/utils/webrtcHelpers";
import {
  Box,
  Circle,
  HStack,
  Icon,
  IconButton,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { CheckCheckIcon, Download } from "lucide-react";
import { Tooltip } from "../ui/tooltip";

interface FileMessageProps {
  file: FileTransfer;
  notifyDownload: (fileId: string) => void;
}

export default function FileMessage({
  file,
  notifyDownload,
}: FileMessageProps) {
  const handleDownload = () => {
    if (!file.blob) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    // Notify peer that file has been downloaded
    if (!file.isOwn) {
      notifyDownload(file.id);
    }
  };

  const getStatusInfo = () => {
    switch (file.status) {
      case "queued":
        return {
          icon: <Spinner size="xs" color="fg.muted" />,
          text: "Queued...",
          color: "fg.muted",
        };
      case "sending":
        return {
          icon: <Spinner size="xs" color="fg.muted" />,
          text: `Sending (${Math.round(file.progress)}%)`,
          color: "fg.muted",
        };
      case "sent":
        return {
          icon: <Icon as={CheckCheckIcon} size="sm" color="fg.muted" />,
          text: "Sent",
          color: "fg.muted",
        };
      case "downloaded-by-peer":
        return {
          icon: <Icon as={CheckCheckIcon} size="sm" color="green.solid" />,
          text: "Downloaded by peer",
          color: "fg.muted",
        };
      case "receiving":
        return {
          icon: <Spinner size="xs" color="fg.muted" />,
          text: `Receiving (${Math.round(file.progress)}%)`,
          color: "fg.muted",
        };
      case "received":
        return {
          icon: <Icon as={CheckCheckIcon} size="sm" color="fg.muted" />,
          text: "Received",
          color: "fg.muted",
        };
      case "downloaded-by-you":
        return {
          icon: <Icon as={CheckCheckIcon} size="sm" color="green.solid" />,
          text: "Downloaded",
          color: "fg.muted",
        };
      default:
        return { text: file.status, color: "fg.muted" };
    }
  };

  const { icon, text, color } = getStatusInfo();
  const isDownloadable = file.status === "received" && !file.isOwn;
  const showProgress = ["sending", "receiving"].includes(file.status);

  return (
    <Stack
      gap={2}
      p={3}
      bg={file.isOwn ? "bg.subtle" : "transparent"}
      rounded="lg"
      w="full"
      outline="1px solid"
      outlineColor={file.isOwn ? "transparent" : "border"}
      align="stretch"
    >
      <HStack gap={3} w="full">
        <Circle size="40px" bg={file.isOwn ? "gray.muted" : "bg.emphasized"}>
          <Icon
            as={getFileTypeIcon({ file: file.file, fileName: file.name })}
            size="lg"
            color="fg.muted"
          />
        </Circle>
        <Stack align="start" gap={0} flex={1} minW="0" maxW="auto">
          <Tooltip content={file.name}>
            <Text
              fontSize="sm"
              fontWeight="medium"
              color="fg"
              wordBreak="break-all"
              lineClamp={1}
            >
              {file.name}
            </Text>
          </Tooltip>
          <Text fontSize="xs" color="fg.muted">
            {formatBytes(file.size)}
          </Text>
        </Stack>

        {isDownloadable ? (
          <IconButton
            variant="outline"
            onClick={handleDownload}
            aria-label="Download"
          >
            <Download />
          </IconButton>
        ) : null}
      </HStack>

      {showProgress && (
        <Box w="full" bg="border" rounded="full" h="4px">
          <Box
            bg="gray.emphasized"
            h="4px"
            w={`${file.progress}%`}
            rounded="full"
          />
        </Box>
      )}
      <HStack justify="space-between" align="center">
        <HStack>
          {icon}
          <Text fontSize="xs" color={color}>
            {text}
          </Text>
        </HStack>
        <Text
          fontSize="xs"
          color="fg.muted"
          mt={1}
          textAlign="right"
          opacity={0.7}
        >
          {file.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </HStack>
    </Stack>
  );
}
