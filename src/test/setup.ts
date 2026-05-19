// Vitest global setup — jsdom + @testing-library/jest-dom matchers + browser
// polyfills, нужные тестам auth-flow (WebAuthn, crypto.subtle, IndexedDB).
//
// Запускается перед каждым тест-suite (см. vite.config.ts → test.setupFiles).

import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// React-Testing-Library: unmount после каждого теста, чтобы avoid state-leak.
afterEach(() => {
  cleanup();
});

// matchMedia — некоторые AntD-компоненты trogают его на mount.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
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

// IntersectionObserver — AntD Table virtual scroll, lazy load.
if (typeof window !== "undefined" && !window.IntersectionObserver) {
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
}

// ResizeObserver — AntD Form / Layout.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// getComputedStyle pseudo-element fallback — jsdom не реализует pseudoElt.
// AntD Modal portal через @rc-component/util/getScrollBarSize вызывает
// getComputedStyle(elt, '::-webkit-scrollbar') → "Not implemented" в jsdom.
// Wrap original — для elt без pseudoElt отдаём оригинал, для pseudo — empty.
if (typeof window !== "undefined") {
  const orig = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((elt: Element, pseudoElt?: string | null) => {
    if (pseudoElt) {
      // Return a minimal empty-style CSSStyleDeclaration-like object.
      // AntD только читает width/height — отдадим "0px".
      return {
        getPropertyValue: () => "",
        width: "0px",
        height: "0px",
      } as unknown as CSSStyleDeclaration;
    }
    return orig(elt);
  }) as typeof window.getComputedStyle;
}
