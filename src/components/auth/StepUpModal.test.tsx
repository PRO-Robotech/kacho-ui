// StepUpModal unit-tests (KAC-127 Phase 2).
//
// Стратегия: AntD Modal mount через @rc-component/portal в jsdom flake'ует
// (useLayoutEffect + getComputedStyle + portal-DOM-attach). Поэтому покрываем
// только critical контракт:
//   1. Компонент монтируется без crash.
//   2. apiClient.onStepUpRequired callback зарегистрирован после mount.
//   3. Вызов callback возвращает Promise (не undefined).
// Реальный визуальный flow покрыт Playwright e2e (auth-flow.spec.ts).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, waitFor, act } from "@testing-library/react";
import { StepUpModal } from "./StepUpModal";
import { AuthProvider } from "@/contexts/AuthContext";

beforeEach(() => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, assign: vi.fn(), pathname: "/", search: "" },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/iam/v1/auth/me")) return new Response("", { status: 401 });
      if (url.includes("/sessions/whoami")) return new Response("", { status: 401 });
      return new Response("", { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("StepUpModal", () => {
  it("smoke: монтируется без crash, modal изначально закрыт", () => {
    render(
      <AuthProvider>
        <StepUpModal />
      </AuthProvider>,
    );
    // Modal закрыт → confirm-кнопка не отрендерена.
    expect(document.querySelector("[data-testid='stepup-confirm']")).toBeNull();
  });

  it("регистрирует onStepUpRequired callback в apiClient после mount", async () => {
    const { apiClient } = await import("@/lib/api-client");
    render(
      <AuthProvider>
        <StepUpModal />
      </AuthProvider>,
    );
    // Дожидаемся init AuthProvider (apiClient.configure установит callback).
    await waitFor(() => {
      // @ts-expect-error access private opts for test
      expect(typeof apiClient.opts.onStepUpRequired).toBe("function");
    });
  });

  it("вызов onStepUpRequired возвращает Promise (не throws)", async () => {
    const { apiClient } = await import("@/lib/api-client");
    render(
      <AuthProvider>
        <StepUpModal />
      </AuthProvider>,
    );
    await waitFor(() => {
      // @ts-expect-error access private opts for test
      expect(typeof apiClient.opts.onStepUpRequired).toBe("function");
    });
    let isPromise = false;
    await act(async () => {
      // @ts-expect-error access private opts for test
      const cb = apiClient.opts.onStepUpRequired as (acr?: string) => Promise<void>;
      const result = cb("3");
      isPromise = typeof result?.then === "function";
      // Прерываем — modal остаётся open в DOM, но мы только проверяем contract.
      // catch на reject (когда тест unmount-ит, pending promise зависает).
      result.catch(() => undefined as void);
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(isPromise).toBe(true);
  });
});
