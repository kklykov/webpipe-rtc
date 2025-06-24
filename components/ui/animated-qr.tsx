"use client";

import { Box, useClipboard } from "@chakra-ui/react";
import { motion, useMotionValue, useSpring } from "motion/react";
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
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use motion values for smooth animations without re-renders
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  // Spring animations for smooth motion
  const springRotateX = useSpring(rotateX, {
    stiffness: 200,
    damping: 25,
    mass: 0.8,
  });
  const springRotateY = useSpring(rotateY, {
    stiffness: 200,
    damping: 25,
    mass: 0.8,
  });

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

    // Normalize and clamp mouse position
    const normalizedX = Math.max(-0.5, Math.min(0.5, mouseX / rect.width));
    const normalizedY = Math.max(-0.5, Math.min(0.5, mouseY / rect.height));

    // Apply rotation with smoother scaling
    const maxRotation = 20;
    rotateX.set(normalizedY * -maxRotation);
    rotateY.set(normalizedX * maxRotation);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
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
          scale: isHovering ? 1.05 : 1,
        }}
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: "center center",
          rotateX: springRotateX,
          rotateY: springRotateY,
          filter: isHovering
            ? "drop-shadow(0 25px 50px rgba(0,0,0,0.25))"
            : "drop-shadow(0 8px 16px rgba(0,0,0,0.1))",
        }}
        transition={{
          duration: 0.6,
          ease: "easeOut",
          scale: {
            type: "spring",
            stiffness: 300,
            damping: 30,
          },
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
