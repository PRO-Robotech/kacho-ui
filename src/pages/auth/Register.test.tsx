// Register page unit-tests (KAC-127 Phase 2).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RegisterPage } from "./Register";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/registration" element={<RegisterPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      ...window.location,
      assign: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function flowFixture() {
  return {
    id: "reg-flow-1",
    type: "browser",
    expires_at: new Date(Date.now() + 60000).toISOString(),
    issued_at: new Date().toISOString(),
    request_url: "https://app.kacho.cloud/self-service/registration",
    ui: {
      action: "/self-service/registration?flow=reg-flow-1",
      method: "POST",
      nodes: [
        {
          type: "input",
          group: "default",
          attributes: { name: "csrf_token", type: "hidden", value: "csrf-reg" },
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
            name: "webauthn_register_trigger",
            type: "button",
            value: JSON.stringify({
              publicKey: {
                rp: { name: "Kachō", id: "kacho.cloud" },
                user: { id: "AAA", name: "x", displayName: "X" },
                challenge: "BBB",
                pubKeyCredParams: [{ type: "public-key", alg: -7 }],
              },
            }),
          },
        },
      ],
    },
  };
}

describe("RegisterPage", () => {
  it("без flow ID — редирект на Kratos init URL", () => {
    renderAt("/auth/registration");
    expect(window.location.assign).toHaveBeenCalled();
    const args = (window.location.assign as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args).toMatch(/\/self-service\/registration\/browser/);
  });

  it("с flow ID — рендерит email + password + passkey button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string) => {
        if (
          typeof input === "string" &&
          input.includes("/self-service/registration/flows")
        ) {
          return new Response(JSON.stringify(flowFixture()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("", { status: 404 });
      }),
    );
    renderAt("/auth/registration?flow=reg-flow-1");
    await waitFor(() => {
      expect(screen.getByTestId("register-email")).toBeInTheDocument();
      expect(screen.getByTestId("register-passkey-btn")).toBeInTheDocument();
      expect(screen.getByTestId("register-password-btn")).toBeInTheDocument();
    });
  });

  it("submit password — POST с email, display_name, password, csrf", async () => {
    let submittedBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
        if (
          typeof input === "string" &&
          input.includes("/self-service/registration/flows")
        ) {
          return new Response(JSON.stringify(flowFixture()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (
          typeof input === "string" &&
          input.includes("/self-service/registration?flow=reg-flow-1")
        ) {
          submittedBody = JSON.parse(init?.body as string);
          return new Response(JSON.stringify({ id: "reg-flow-1", ui: { nodes: [], action: "", method: "POST" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        // HIBP check.
        if (typeof input === "string" && input.includes("pwnedpasswords.com")) {
          return new Response("ABCDE:0\nFFFFF:0", { status: 200 });
        }
        return new Response("", { status: 404 });
      }),
    );

    renderAt("/auth/registration?flow=reg-flow-1");
    await waitFor(() => expect(screen.getByTestId("register-email")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.type(screen.getByTestId("register-email"), "alice@example.com");
    await user.type(screen.getByTestId("register-name"), "Alice");
    await user.type(screen.getByTestId("register-password"), "SafePass123!");
    // Дать HIBP debounced effect отработать.
    await new Promise((r) => setTimeout(r, 600));
    await user.click(screen.getByTestId("register-password-btn"));

    await waitFor(() => expect(submittedBody).not.toBeNull());
    expect(submittedBody!.method).toBe("password");
    const traits = submittedBody!.traits as Record<string, unknown>;
    expect(traits.email).toBe("alice@example.com");
    expect(traits.display_name).toBe("Alice");
    expect(submittedBody!.password).toBe("SafePass123!");
    expect(submittedBody!.csrf_token).toBe("csrf-reg");
  });
});
