import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

// Custom theme with semantic tokens only
const config = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        // Background tokens
        bg: { value: "var(--bg)" },
        "bg.muted": { value: "var(--bg-light)" },
        "bg.subtle": { value: "var(--bg-dark)" },
        "bg.emphasized": { value: "var(--highlight)" },

        // Foreground tokens
        fg: { value: "var(--text)" },
        "fg.muted": { value: "var(--text-muted)" },

        // Border tokens
        border: { value: "var(--border)" },
        "border.subtle": { value: "var(--border-muted)" },

        // Brand colors
        "brand.solid": { value: "var(--primary)" },
        "brand.muted": { value: "var(--primary)" },

        // Gray scale mapping
        "gray.solid": { value: "var(--highlight)" },
        "gray.muted": { value: "var(--bg-light)" },
        "gray.subtle": { value: "var(--bg-dark)" },
        "gray.emphasized": { value: "var(--highlight)" },
        "gray.fg": { value: "var(--text)" },
        "gray.contrast": { value: "var(--text)" },

        // Status colors
        "green.solid": { value: "var(--success)" },
        "green.emphasized": { value: "var(--success)" },
        "green.contrast": { value: "var(--text)" },

        "red.solid": { value: "var(--danger)" },
        "red.emphasized": { value: "var(--danger)" },

        "orange.solid": { value: "var(--warning)" },
        "orange.emphasized": { value: "var(--warning)" },
        "orange.subtle": { value: "var(--bg-light)" },

        "blue.solid": { value: "var(--info)" },
        "blue.emphasized": { value: "var(--info)" },
      },
    },
  },
});

export default createSystem(defaultConfig, config);
