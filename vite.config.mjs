import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // ngrok and similar tunnels use changing subdomains, so a fixed allowlist
    // becomes brittle during mobile debugging. This keeps dev tunnels working.
    allowedHosts: true
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    globals: true
  }
});
