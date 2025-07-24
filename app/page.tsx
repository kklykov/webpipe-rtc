"use client";

import Chat from "@/components/app/Chat";
import ConnectionManager from "@/components/app/ConnectionManager";
import { FilesSection } from "@/components/app/FilesSection";
import { UserProfile } from "@/components/app/UserProfile";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Box, HStack, VStack } from "@chakra-ui/react";
import { useEffect } from "react";

export default function Home() {
  const { connected, joinConnection } = useWebRTC();

  // Auto-join room from URL query parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");

    if (roomParam && !connected) {
      console.log(`🔗 Auto-joining room from URL: ${roomParam}`);
      joinConnection(roomParam);

      // Clean up URL without triggering a page reload
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url.toString());
    }
  }, [connected, joinConnection]);

  // Show connection manager when not connected
  if (!connected) {
    return <ConnectionManager />;
  }

  // Show sidebar + chat layout when connected
  return (
    <HStack h="100vh" gap={0} bg="bg">
      {/* Sidebar - Only visible on tablets and up */}
      <Box
        minW="240px"
        w="280px"
        h="100vh"
        bg="bg"
        borderRight="1px solid"
        borderColor="border"
        display={{ base: "none", md: "flex" }}
        flexDirection="column"
        overflowY="auto"
      >
        {/* User Profile Section */}
        <UserProfile />
        {/* Files Section */}
        <VStack flex={1} align="stretch" gap={0} h="max-content" py={2}>
          <Box flex={1} p={4} overflow="hidden">
            <FilesSection />
          </Box>
        </VStack>
      </Box>

      {/* Chat Section - Full width on mobile, remaining space on desktop */}
      <Box flex={1} h="100vh" bg="bg.muted">
        <Chat />
      </Box>
    </HStack>
  );
}
