/// <reference types="vitest" />
import path from "node:path";
import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// Vitest config через `test`-блок — приведение типа, т.к. vite.UserConfig
// не знает про vitest extension (см. https://vitest.dev/config/).
const config: UserConfig & { test?: Record<string, unknown> } = {
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // dev: проксируем domain-prefixed paths на api-gateway (port-forward на 8080).
      // URL-ы verbatim из proto google.api.http annotations.
      // KAC-124: /organization-manager и /resource-manager удалены — заменены /iam.
      "/vpc": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/compute": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/iam": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/operations": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/healthz": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/readyz": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      // KAC-127 (Phase 2): Kratos self-service / Hydra OAuth endpoints.
      // В prod ingress сам ведёт `/.ory/kratos/public/*` на Kratos и
      // `/oauth2/*` на Hydra. В dev — те же дороги через api-gateway или
      // прямые upstream порты (Kratos 4433, Hydra 4444).
      "/.ory": {
        target: process.env.KACHO_KRATOS_BASE || "http://localhost:4433",
        changeOrigin: true,
        // В prod ingress срезает префикс `/.ory/kratos/public` перед Kratos;
        // в dev делаем то же самое — Kratos отдаёт flow на голом /self-service/*.
        rewrite: (p) => p.replace(/^\/\.ory\/kratos\/public/, ""),
      },
      "/self-service": {
        target: process.env.KACHO_KRATOS_BASE || "http://localhost:4433",
        changeOrigin: true,
      },
      "/oauth2": {
        target: process.env.KACHO_HYDRA_BASE || "http://localhost:4444",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Не гоняем Playwright e2e через vitest.
    exclude: ["node_modules", "dist", "e2e/**", ".playwright-artifacts-*/**"],
  },
};

export default defineConfig(config);
