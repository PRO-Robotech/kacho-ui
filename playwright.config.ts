import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://console.kacho.local";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      // host-resolver-rules: kacho-ui сервится через ingress на console.kacho.local
      // → маппим на 127.0.0.1 в самом Chromium, не нужно править /etc/hosts.
      args: ["--host-resolver-rules=MAP console.kacho.local 127.0.0.1, MAP api.kacho.local 127.0.0.1"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
