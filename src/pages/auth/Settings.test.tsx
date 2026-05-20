// Settings page unit-tests (KAC-127 Phase 2).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SettingsPage } from "./Settings";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/settings" element={<SettingsPage />} />
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
      pathname: "/auth/settings",
      search: "",
    },
  });
});

afterEach(() => vi.restoreAllMocks());

function flowWithPasskeys(opts: { passkeys?: number; totp?: boolean } = {}) {
  const nodes: Array<Record<string, unknown>> = [
    {
      type: "input",
      group: "default",
      attributes: { name: "csrf_token", type: "hidden", value: "csrf-set" },
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
            user: { id: "AAA", name: "alice", displayName: "Alice" },
            challenge: "BBB",
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          },
        }),
      },
    },
  ];
  for (let i = 0; i < (opts.passkeys ?? 0); i++) {
    nodes.push({
      type: "input",
      group: "webauthn",
      attributes: {
        name: "webauthn_remove",
        type: "submit",
        value: `cred-${i}`,
      },
      meta: { label: { text: `Passkey ${i + 1}` } },
    });
  }
  if (opts.totp) {
    nodes.push({
      type: "input",
      group: "totp",
      attributes: { name: "totp_unlink", type: "submit" },
    });
  } else {
    nodes.push({
      type: "img",
      group: "totp",
      attributes: { name: "totp_qr", src: "data:image/png;base64,AAA" },
    });
    nodes.push({
      type: "input",
      group: "totp",
      attributes: { name: "totp_code", type: "text" },
    });
  }
  return {
    id: "set-1",
    type: "browser",
    expires_at: new Date(Date.now() + 60000).toISOString(),
    issued_at: new Date().toISOString(),
    request_url: "https://app.kacho.cloud/self-service/settings",
    ui: {
      action: "/self-service/settings?flow=set-1",
      method: "POST",
      nodes,
    },
  };
}

describe("SettingsPage", () => {
  it("без flow ID — редирект на Kratos init URL", () => {
    renderAt("/auth/settings");
    expect(window.location.assign).toHaveBeenCalled();
    expect(
      (window.location.assign as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toMatch(/\/self-service\/settings\/browser/);
  });

  it("рендерит passkey list + TOTP enroll если TOTP не подключён", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string) => {
        if (
          typeof input === "string" &&
          input.includes("/self-service/settings/flows")
        ) {
          return new Response(
            JSON.stringify(flowWithPasskeys({ passkeys: 2, totp: false })),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("", { status: 404 });
      }),
    );
    renderAt("/auth/settings?flow=set-1");
    await waitFor(() => {
      expect(screen.getByTestId("settings-add-passkey")).toBeInTheDocument();
      expect(screen.getByTestId("settings-remove-passkey-cred-0")).toBeInTheDocument();
      expect(screen.getByTestId("settings-remove-passkey-cred-1")).toBeInTheDocument();
      expect(screen.getByTestId("settings-totp-code")).toBeInTheDocument();
      expect(screen.getByTestId("settings-totp-submit")).toBeInTheDocument();
    });
  });

  it("TOTP уже подключён → показывает кнопку отключения", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify(flowWithPasskeys({ passkeys: 1, totp: true })),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    renderAt("/auth/settings?flow=set-1");
    await waitFor(() => {
      expect(screen.getByTestId("settings-totp-unlink")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("settings-totp-submit")).not.toBeInTheDocument();
  });
});
