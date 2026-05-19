// Logout page unit-tests (KAC-127 Phase 2).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LogoutPage } from "./Logout";
import { AuthProvider } from "@/contexts/AuthContext";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/logout" element={<LogoutPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, assign: vi.fn(), pathname: "/logout", search: "" },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/iam/v1/auth/me")) return new Response("", { status: 401 });
      if (url.includes("/sessions/whoami")) return new Response("", { status: 401 });
      if (url.includes("/self-service/logout/browser")) {
        return new Response(
          JSON.stringify({ logout_token: "lo-token", logout_url: "/logout" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/self-service/logout?token=")) {
        return new Response("", { status: 204 });
      }
      if (url.includes("/oauth2/sessions/logout")) {
        return new Response("", { status: 200 });
      }
      return new Response("", { status: 404 });
    }),
  );
});

afterEach(() => vi.restoreAllMocks());

describe("LogoutPage", () => {
  it("вызывает logout flow + показывает success state", async () => {
    renderAt("/logout");
    await waitFor(() => {
      expect(screen.getByTestId("logout-success")).toBeInTheDocument();
    });
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) =>
      typeof c[0] === "string" ? c[0] : (c[0] as Request).url,
    );
    expect(calls.some((u) => u.includes("/self-service/logout/browser"))).toBe(true);
    expect(calls.some((u) => u.includes("/self-service/logout?token=lo-token"))).toBe(true);
  });
});
