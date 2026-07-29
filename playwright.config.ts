import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against a deployed target (a Vercel preview or production),
// set via BASE_URL, so they exercise the real widget + backend end-to-end. They
// need a target with working LLM env, so they're run on demand
// (`BASE_URL=… npm run test:e2e`) rather than gating every PR.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
