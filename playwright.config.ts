import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  webServer: {
    command: "npm run dev",
    // MUST match the dev-server port pinned in vite.config.ts (`server.port: 5200`).
    // This was previously 5175, which silently "worked" locally because
    // `reuseExistingServer` latched onto whatever unrelated process happened to be
    // listening on 5175 — every spec then ran against the wrong app. If the vite
    // port ever changes, change BOTH this and `baseURL` below in lockstep.
    port: 5200,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:5200",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },
  ],
});
