import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];

export default defineConfig({
  // GitHub Pages serves project sites from /<repo-name>/, not from /. In local
  // development we still want normal root-relative paths.
  base: isGithubActions && repositoryName ? `/${repositoryName}/` : "/",
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
