"use client";

import { ChakraProvider, createSystem, defaultConfig } from "@chakra-ui/react";
import { ColorModeProvider, type ColorModeProviderProps } from "./color-mode";

const system = createSystem(defaultConfig, {
  globalCss: {
    body: {
      colorPalette: "teal",
    },
  },
  theme: {
    tokens: {
      fonts: {
        body: { value: "var(--font-inter)" },
      },
    },
    semanticTokens: {
      radii: {
        l1: { value: "0.25rem" },
        l2: { value: "0.375rem" },
        l3: { value: "0.5rem" },
      },
    },
  },
});

export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider {...props} />
    </ChakraProvider>
  );
}
