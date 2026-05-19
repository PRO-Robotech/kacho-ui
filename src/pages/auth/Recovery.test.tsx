// Recovery page unit-tests (KAC-127 Phase 2).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RecoveryPage } from "./Recovery";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/recovery" element={<RecoveryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, assign: vi.fn() },
  });
});

afterEach(() => vi.restoreAllMocks());

function flowFixture(state?: string) {
  return {
    id: "rec-1",
    type: "browser",
    expires_at: new Date(Date.now() + 60000).toISOString(),
    issued_at: new Date().toISOString(),
    request_url: "https://app.kacho.cloud/self-service/recovery",
    state: state ?? "choose_method",
    ui: {
      action: "/self-service/recovery?flow=rec-1",
      method: "POST",
      nodes: [
        {
          type: "input",
          group: "default",
          attributes: { name: "csrf_token", type: "hidden", value: "csrf-rec" },
        },
      ],
    },
  };
}

describe("RecoveryPage", () => {
  it("без flow ID — редирект на Kratos init URL", () => {
    renderAt("/auth/recovery");
    expect(window.location.assign).toHaveBeenCalled();
    expect(
      (window.location.assign as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toMatch(/\/self-service\/recovery\/browser/);
  });

  it("step=email — рендерит email input + submit + TTL hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string) => {
        if (
          typeof input === "string" &&
          input.includes("/self-service/recovery/flows")
        ) {
          return new Response(JSON.stringify(flowFixture()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("", { status: 404 });
      }),
    );
    renderAt("/auth/recovery?flow=rec-1");
    await waitFor(() => {
      expect(screen.getByTestId("recovery-email")).toBeInTheDocument();
      expect(screen.getByTestId("recovery-submit")).toBeInTheDocument();
    });
    // TTL hint вычисляется из config.recoveryLinkTtlMin (default 5).
    expect(screen.getByText(/5 минут/)).toBeInTheDocument();
  });

  it("submit email → POST к Kratos с method=code", async () => {
    let body: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
        if (
          typeof input === "string" &&
          input.includes("/self-service/recovery/flows")
        ) {
          return new Response(JSON.stringify(flowFixture()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (typeof input === "string" && input.includes("/self-service/recovery?flow=rec-1")) {
          body = JSON.parse(init?.body as string);
          return new Response(JSON.stringify(flowFixture("sent_email")), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("", { status: 404 });
      }),
    );
    renderAt("/auth/recovery?flow=rec-1");
    await waitFor(() => expect(screen.getByTestId("recovery-submit")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.type(screen.getByTestId("recovery-email"), "alice@example.com");
    await user.click(screen.getByTestId("recovery-submit"));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.email).toBe("alice@example.com");
    expect(body!.method).toBe("code");
    expect(body!.csrf_token).toBe("csrf-rec");

    // После success → step=sent.
    await waitFor(() => {
      expect(screen.getByTestId("recovery-back-to-login")).toBeInTheDocument();
    });
  });

  it("?code=... в URL — авто-submit + переход в passkey-enroll", async () => {
    let submitCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string) => {
        if (
          typeof input === "string" &&
          input.includes("/self-service/recovery/flows")
        ) {
          return new Response(JSON.stringify(flowFixture()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (
          typeof input === "string" &&
          input.includes("/self-service/recovery?flow=rec-1")
        ) {
          submitCount++;
          return new Response(JSON.stringify(flowFixture("passed_challenge")), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("", { status: 404 });
      }),
    );
    renderAt("/auth/recovery?flow=rec-1&code=ABCDEF");

    await waitFor(() => {
      expect(submitCount).toBeGreaterThan(0);
      expect(screen.getByTestId("recovery-passkey-enroll")).toBeInTheDocument();
    });
  });
});
