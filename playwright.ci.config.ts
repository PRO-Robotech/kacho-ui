import { defineConfig, devices } from "@playwright/test";

// CI-конфиг Playwright: backend-free тесты из e2e/ci/ (REST мокается через
// page.route, см. e2e/ci/_mocks.ts). UI обслуживается `vite preview` из
// собранного dist/ — kind-стенд / авторизация не нужны, гоняется в обычной
// CI-сборке (.github/workflows/ci.yaml job `e2e`).
//
// Backend-зависимые спеки (e2e/*.spec.ts) сюда НЕ входят — у них свой
// playwright.config.ts и они требуют развёрнутого стенда.

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e/ci",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview",
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
