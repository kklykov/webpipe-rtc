"use client";

import { Box, useClipboard } from "@chakra-ui/react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import QRCode from "react-qr-code";

interface AnimatedQRProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
}

const MotionBox = motion.create(Box);

export default function AnimatedQR({
  value,
  size = 500,
  bgColor = "transparent",
  fgColor = "currentColor",
}: AnimatedQRProps) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { copy } = useClipboard({
    value,
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    const rotateXValue = (mouseY / rect.height) * -15; // Max 15 degrees
    const rotateYValue = (mouseX / rect.width) * 15; // Max 15 degrees

    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setIsHovering(false);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  return (
    <div style={{ perspective: "1000px" }}>
      <MotionBox
        ref={containerRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: 1,
          y: 0,
          rotateX: rotateX,
          rotateY: rotateY,
          scale: isHovering ? 1.02 : 1,
        }}
        transition={{
          duration: 0.6,
          ease: "easeOut",
          rotateX: {
            type: "spring",
            stiffness: 400,
            damping: 40,
          },
          rotateY: {
            type: "spring",
            stiffness: 400,
            damping: 40,
          },
          scale: {
            type: "spring",
            stiffness: 400,
            damping: 40,
          },
        }}
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: "center center",
          filter: isHovering
            ? "drop-shadow(0 20px 40px rgba(0,0,0,0.2))"
            : "drop-shadow(0 8px 16px rgba(0,0,0,0.1))",
        }}
        p={4}
        bg="bg.emphasized"
        rounded="xl"
        shadow="lg"
        border="1px solid"
        borderColor="border.subtle"
        cursor="pointer"
        position="relative"
        w="fit-content"
        mx="auto"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        onClick={() => copy()}
      >
        <QRCode
          value={value}
          size={size}
          bgColor={bgColor}
          fgColor={fgColor}
          level="M"
          style={{
            height: "auto",
            maxWidth: "100%",
            width: "100%",
          }}
        />
      </MotionBox>
    </div>
  );
}
