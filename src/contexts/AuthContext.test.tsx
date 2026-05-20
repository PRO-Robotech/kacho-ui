// AuthContext unit-tests (KAC-127 Phase 2).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth, isMfaFresh } from "./AuthContext";
import { clearDpopKeyPair, setKeyPairForTesting } from "@/lib/dpop";

function TestPanel() {
  const { user, loading, accessToken, mfaFreshUntil, setAccessToken, markMfaFresh } =
    useAuth();
  return (
    <div>
      <div data-testid="loading">{loading ? "loading" : "idle"}</div>
      <div data-testid="user">{user ? user.id : "none"}</div>
      <div data-testid="token">{accessToken ?? "null"}</div>
      <div data-testid="fresh">{mfaFreshUntil}</div>
      <button onClick={() => setAccessToken("tok-1")}>set-token</button>
      <button onClick={() => markMfaFresh(600)}>mark-fresh</button>
    </div>
  );
}

beforeEach(async () => {
  setKeyPairForTesting(null);
  await clearDpopKeyPair();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/iam/v1/auth/me")) {
        return new Response("", { status: 401 });
      }
      if (url.includes("/sessions/whoami")) {
        return new Response("", { status: 401 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  setKeyPairForTesting(null);
  await clearDpopKeyPair();
});

describe("AuthContext", () => {
  it("стартует loading, потом user=null если /me возвращает 401", async () => {
    render(
      <AuthProvider>
        <TestPanel />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("idle");
    });
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("token")).toHaveTextContent("null");
  });

  it("setAccessToken обновляет state и token доступен через useAuth", async () => {
    render(
      <AuthProvider>
        <TestPanel />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("idle");
    });
    await act(async () => {
      (screen.getByText("set-token") as HTMLButtonElement).click();
    });
    expect(screen.getByTestId("token")).toHaveTextContent("tok-1");
  });

  it("markMfaFresh устанавливает mfaFreshUntil в будущее", async () => {
    render(
      <AuthProvider>
        <TestPanel />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("idle");
    });
    const before = Math.floor(Date.now() / 1000);
    await act(async () => {
      (screen.getByText("mark-fresh") as HTMLButtonElement).click();
    });
    const fresh = Number(screen.getByTestId("fresh").textContent);
    expect(fresh).toBeGreaterThanOrEqual(before + 600 - 1);
    expect(fresh).toBeLessThanOrEqual(before + 601);
  });

  it("isMfaFresh — true когда mfaFreshUntil > now, false иначе", () => {
    expect(isMfaFresh({ mfaFreshUntil: 0 })).toBe(false);
    expect(isMfaFresh({ mfaFreshUntil: Math.floor(Date.now() / 1000) + 60 })).toBe(true);
    expect(isMfaFresh({ mfaFreshUntil: Math.floor(Date.now() / 1000) - 60 })).toBe(false);
  });

  it("useAuth вне AuthProvider — throws", () => {
    function Bare() {
      useAuth();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/useAuth must be used within/);
    spy.mockRestore();
  });
});
