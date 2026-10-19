import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      VITE_SUPABASE_URL: "https://mock-ci-project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "mock-publishable-key-for-tests",
      SUPABASE_URL: "https://mock-ci-project.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "mock-publishable-key-for-tests",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
