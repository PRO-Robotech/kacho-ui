// RequireAuth + RequireMFAFresh route-guard unit-tests (KAC-127 Phase 2).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./RequireAuth";
import { RequireMFAFresh } from "./RequireMFAFresh";
import { AuthProvider } from "@/contexts/AuthContext";

function renderAt(path: string, children: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, assign: vi.fn(), pathname: "/", search: "" },
  });
});

afterEach(() => vi.restoreAllMocks());

describe("RequireAuth", () => {
  it("user=null → редирект на /auth/login с return_to", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/iam/v1/auth/me")) return new Response("", { status: 401 });
        if (url.includes("/sessions/whoami")) return new Response("", { status: 401 });
        return new Response("", { status: 200 });
      }),
    );
    renderAt(
      "/dashboard",
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<div data-testid="protected">protected</div>} />
        </Route>
        <Route path="/auth/login" element={<div data-testid="login">login</div>} />
      </Routes>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("login")).toBeInTheDocument();
      expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    });
  });

  it("user authenticated → render children", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/iam/v1/auth/me")) {
          return new Response(
            JSON.stringify({ user: { id: "usr-1", subject_type: "user" } }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/sessions/whoami")) return new Response("", { status: 401 });
        return new Response("", { status: 200 });
      }),
    );
    renderAt(
      "/dashboard",
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<div data-testid="protected">ok</div>} />
        </Route>
      </Routes>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("protected")).toBeInTheDocument();
    });
  });
});

describe("RequireMFAFresh", () => {
  it("без mfa_fresh → показывает warning + кнопку trigger", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/iam/v1/auth/me")) {
          return new Response(
            JSON.stringify({ user: { id: "usr-1", subject_type: "user" } }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/sessions/whoami")) return new Response("", { status: 401 });
        return new Response("", { status: 200 });
      }),
    );
    renderAt(
      "/iam/access-bindings",
      <Routes>
        <Route element={<RequireMFAFresh autoTrigger={false} />}>
          <Route path="/iam/access-bindings" element={<div data-testid="sensitive">data</div>} />
        </Route>
      </Routes>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("require-mfa-fresh")).toBeInTheDocument();
      expect(screen.queryByTestId("sensitive")).not.toBeInTheDocument();
    });
  });
});
