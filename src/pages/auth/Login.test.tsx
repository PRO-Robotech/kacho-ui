// Login page unit-tests (KAC-127 Phase 2).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LoginPage } from "./Login";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  // Stub window.location.assign — Login делает redirect когда нет flow ID.
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      ...window.location,
      assign: vi.fn(),
      pathname: "/auth/login",
      search: "",
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LoginPage", () => {
  it("без flow ID — редирект на Kratos init URL", () => {
    renderAt("/auth/login");
    expect(window.location.assign).toHaveBeenCalled();
    const args = (window.location.assign as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args).toMatch(/\/self-service\/login\/browser/);
  });

  it("с flow ID — рендерит UI с password + passkey кнопками", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      if (typeof input === "string" && input.includes("/self-service/login/flows")) {
        return new Response(
          JSON.stringify({
            id: "flow-xyz",
            type: "browser",
            expires_at: new Date(Date.now() + 60000).toISOString(),
            issued_at: new Date().toISOString(),
            request_url: "https://app.kacho.cloud/self-service/login",
            ui: {
              action: "/self-service/login?flow=flow-xyz",
              method: "POST",
              nodes: [
                {
                  type: "input",
                  group: "default",
                  attributes: { name: "csrf_token", type: "hidden", value: "csrf-1" },
                },
                {
                  type: "input",
                  group: "password",
                  attributes: { name: "identifier", type: "email", required: true },
                },
                {
                  type: "input",
                  group: "password",
                  attributes: { name: "password", type: "password", required: true },
                },
                {
                  type: "input",
                  group: "webauthn",
                  attributes: {
                    name: "webauthn_login_trigger",
                    type: "button",
                    value: JSON.stringify({
                      publicKey: {
                        challenge: "AAA",
                        rpId: "kacho.cloud",
                        userVerification: "preferred",
                      },
                    }),
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/auth/login?flow=flow-xyz");

    await waitFor(() => {
      expect(screen.getByTestId("login-passkey-btn")).toBeInTheDocument();
      expect(screen.getByTestId("login-password-btn")).toBeInTheDocument();
    });
    expect(screen.getByTestId("login-identifier")).toBeInTheDocument();
    expect(screen.getByTestId("login-password")).toBeInTheDocument();
  });

  it("submit password — POST к Kratos с CSRF + method=password", async () => {
    const submitCallback = vi.fn();
    const fetchMock = vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
      if (typeof input === "string" && input.includes("/self-service/login/flows")) {
        return new Response(
          JSON.stringify({
            id: "flow-abc",
            type: "browser",
            expires_at: new Date(Date.now() + 60000).toISOString(),
            issued_at: new Date().toISOString(),
            request_url: "https://app.kacho.cloud/self-service/login",
            ui: {
              action: "/self-service/login?flow=flow-abc",
              method: "POST",
              nodes: [
                {
                  type: "input",
                  group: "default",
                  attributes: { name: "csrf_token", type: "hidden", value: "csrf-abc" },
                },
                {
                  type: "input",
                  group: "password",
                  attributes: { name: "identifier", type: "email", required: true },
                },
                {
                  type: "input",
                  group: "password",
                  attributes: { name: "password", type: "password", required: true },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (typeof input === "string" && input.includes("/self-service/login?flow=flow-abc")) {
        submitCallback(JSON.parse(init?.body as string));
        return new Response(
          JSON.stringify({ id: "flow-abc", ui: { nodes: [], action: "", method: "POST" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/auth/login?flow=flow-abc");
    await waitFor(() => expect(screen.getByTestId("login-password-btn")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.type(screen.getByTestId("login-identifier"), "alice@example.com");
    await user.type(screen.getByTestId("login-password"), "P@ssw0rd!");
    await user.click(screen.getByTestId("login-password-btn"));

    await waitFor(() => expect(submitCallback).toHaveBeenCalled());
    const body = submitCallback.mock.calls[0][0];
    expect(body.method).toBe("password");
    expect(body.identifier).toBe("alice@example.com");
    expect(body.password).toBe("P@ssw0rd!");
    expect(body.csrf_token).toBe("csrf-abc");
  });
});
