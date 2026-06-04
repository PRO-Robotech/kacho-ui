// Захват экранов kacho-ui в PNG для переноса в Figma (референс-слой).
// Запуск: node design/figma/capture.mjs  (предварительно: npm run dev на :5173)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.CAP_BASE ?? "http://localhost:5173";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// Публичные (не требуют сессии) роуты. Авторизованные экраны — через html.to.design
// из залогиненного браузера, либо при поднятом стенде добавить сюда.
const ROUTES = [
  ["auth-login", "/auth/login"],
  ["auth-signup", "/signup"],
  ["auth-registration", "/auth/registration"],
  ["auth-recovery", "/auth/recovery"],
  ["auth-settings", "/auth/settings"],
];

const browser = await chromium.launch();
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  for (const [name, path] of ROUTES) {
    try {
      await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 15000 });
      // ThemeProvider читает data-theme — выставим явно, чтобы снять обе темы.
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      await page.waitForTimeout(600);
      const file = `${OUT}${name}.${theme}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log("OK ", file);
    } catch (e) {
      console.log("FAIL", name, theme, String(e).split("\n")[0]);
    }
  }
  await ctx.close();
}
await browser.close();
console.log("done →", OUT);
