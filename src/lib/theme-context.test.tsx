// KAC-246: тесты дуал-темы (dark/light) — ThemeProvider + useThemeMode.
// Покрывает: дефолт из localStorage; дефолт из prefers-color-scheme; toggle.

import { act } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useThemeMode } from "@/lib/theme-context";

const STORAGE_KEY = "kacho-theme";

function Probe() {
  const { mode, setMode, toggle } = useThemeMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => toggle()}>toggle</button>
      <button onClick={() => setMode("light")}>set-light</button>
      <button onClick={() => setMode("dark")}>set-dark</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

/** Подмена window.matchMedia с управляемым prefers-color-scheme: light. */
function mockMatchMedia(prefersLight: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("light") ? prefersLight : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe("ThemeProvider / useThemeMode (KAC-246)", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("дефолт берётся из localStorage (light), игнорируя prefers-color-scheme", () => {
    mockMatchMedia(false); // система — dark
    localStorage.setItem(STORAGE_KEY, "light");
    renderProbe();
    expect(screen.getByTestId("mode").textContent).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("дефолт берётся из localStorage (dark)", () => {
    mockMatchMedia(true); // система — light
    localStorage.setItem(STORAGE_KEY, "dark");
    renderProbe();
    expect(screen.getByTestId("mode").textContent).toBe("dark");
  });

  it("без localStorage — дефолт из prefers-color-scheme: light", () => {
    mockMatchMedia(true);
    renderProbe();
    expect(screen.getByTestId("mode").textContent).toBe("light");
  });

  it("без localStorage и без prefers light — дефолт dark", () => {
    mockMatchMedia(false);
    renderProbe();
    expect(screen.getByTestId("mode").textContent).toBe("dark");
  });

  it("toggle меняет mode dark→light, пишет localStorage и ставит dataset.theme", () => {
    mockMatchMedia(false); // старт dark
    renderProbe();
    expect(screen.getByTestId("mode").textContent).toBe("dark");

    act(() => {
      screen.getByText("toggle").click();
    });

    expect(screen.getByTestId("mode").textContent).toBe("light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("setMode пишет localStorage и dataset.theme", () => {
    mockMatchMedia(false);
    renderProbe();

    act(() => {
      screen.getByText("set-light").click();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    act(() => {
      screen.getByText("set-dark").click();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
