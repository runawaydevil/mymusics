import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { resolveApiPort, resolveDevWebPort } from "./config/ports.js";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const merged: NodeJS.ProcessEnv = { ...process.env, ...env };
  const apiPort = resolveApiPort(merged);
  const webPort = resolveDevWebPort(merged);

  return {
    plugins: [react()],
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: webPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
