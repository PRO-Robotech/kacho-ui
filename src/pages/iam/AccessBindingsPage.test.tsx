// AccessBindingsPage tests (KAC items 1, 3, 5).
//
// Покрывает:
//   - byAccount tab появляется и работает для админа (item #1);
//   - 409 ALREADY_EXISTS → inline Alert (item #3) с verbatim message,
//     модалка НЕ закрывается;
//   - URL-preset `?modal=cluster-admin&resource_type=cluster&...` → auto-open
//     модалка с pre-fixed cluster_kacho_root (item #5).
//
// Тесты НЕ покрывают полную submit-flow (Operation polling) — это уже
// проверяется существующими тестами `useIamMutation` через component-tests.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { AccessBindingsPage } from "./AccessBindingsPage";
import { AuthProvider } from "@/contexts/AuthContext";

interface FetchScenario {
  systemAdmin?: boolean;
  accounts?: Array<{ account_id: string; account_name: string; roles: string[] }>;
  /** Если true — POST /iam/v1/accessBindings вернёт 409 ALREADY_EXISTS. */
  postReturnsAlreadyExists?: boolean;
}

function setupFetch(s: FetchScenario) {
  const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/iam/v1/me") && !url.includes("auth")) {
      return new Response(
        JSON.stringify({
          subject: "user:usr-1",
          userId: "usr-1",
          email: "a@kacho.cloud",
          systemAdmin: !!s.systemAdmin,
          clusterViewer: false,
          accounts: (s.accounts ?? []).map((a) => ({
            accountId: a.account_id,
            accountName: a.account_name,
            roles: a.roles,
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/iam/v1/auth/me")) {
      return new Response(
        JSON.stringify({ user: { id: "usr-1", subject_type: "user" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/sessions/whoami")) return new Response("", { status: 401 });

    // List endpoints — пустые ответы.
    if (url.includes("/iam/v1/accounts/") && url.includes("/accessBindings")) {
      // ListByAccount endpoint
      return new Response(JSON.stringify({ accessBindings: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/iam/v1/accessBindings:listBySubject")) {
      return new Response(JSON.stringify({ accessBindings: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/iam/v1/accessBindings:listByResource")) {
      return new Response(JSON.stringify({ accessBindings: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/iam/v1/accessBindings") && method === "POST") {
      if (s.postReturnsAlreadyExists) {
        return new Response(
          JSON.stringify({
            code: "6",
            message:
              "these permissions are already granted to usr-1 on cluster:cluster_kacho_root",
            details: [],
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ operation: { id: "op-1", done: false } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/iam/v1/accounts")) {
      return new Response(
        JSON.stringify({
          accounts: (s.accounts ?? []).map((a) => ({
            id: a.account_id,
            name: a.account_name,
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/iam/v1/users")) {
      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/iam/v1/roles")) {
      return new Response(JSON.stringify({ roles: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/operations/")) {
      return new Response(JSON.stringify({ id: "op-1", done: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("", { status: 200 });
  });
  vi.stubGlobal("fetch", f);
  return f;
}

function renderPage(initialPath = "/iam/access-bindings") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <ConfigProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[initialPath]}>
          <AuthProvider>
            <Routes>
              <Route path="/iam/access-bindings" element={<AccessBindingsPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, assign: vi.fn(), pathname: "/", search: "" },
  });
});

afterEach(() => vi.restoreAllMocks());

describe("AccessBindingsPage — byAccount tab (KAC item #1)", () => {
  it("admin → видит tab 'По account'у (admin)' и он активен по дефолту", async () => {
    setupFetch({
      systemAdmin: true,
      accounts: [{ account_id: "acc-1", account_name: "Acme", roles: ["roles/admin"] }],
    });
    renderPage();
    await waitFor(() => {
      const seg = screen.getByTestId("access-bindings-mode");
      expect(seg.textContent).toContain("admin");
    });
  });

  it("non-admin без accounts → НЕ видит byAccount tab", async () => {
    setupFetch({ systemAdmin: false, accounts: [] });
    renderPage();
    await waitFor(() => {
      const seg = screen.getByTestId("access-bindings-mode");
      expect(seg.textContent).not.toContain("admin");
    });
  });
});

describe("AccessBindingsPage — URL preset (KAC item #5)", () => {
  it("?modal=cluster-admin → авто-открывается модалка с pre-fixed cluster_kacho_root", async () => {
    setupFetch({ systemAdmin: true });
    renderPage(
      "/iam/access-bindings?modal=cluster-admin&resource_type=cluster&resource_id=cluster_kacho_root&role_id=roles/admin",
    );
    await waitFor(() => {
      // Модалка должна быть открыта — проверяем по наличию поля subject_id и
      // pre-fill cluster_kacho_root в Resource Input.
      expect(screen.getByText(/Cluster admin grant/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("cluster_kacho_root")).toBeInTheDocument();
  });
});

describe("AccessBindingsPage — duplicate 409 inline error (KAC item #3)", () => {
  it("POST → 409 → показывает Alert с verbatim message, модалка НЕ закрывается", async () => {
    setupFetch({
      systemAdmin: true,
      postReturnsAlreadyExists: true,
      accounts: [{ account_id: "acc-1", account_name: "A", roles: [] }],
    });
    const user = userEvent.setup();
    renderPage(
      "/iam/access-bindings?modal=cluster-admin&resource_type=cluster&resource_id=cluster_kacho_root&role_id=roles/admin&subject_type=user&subject_id=usr-1",
    );
    await waitFor(() => {
      expect(screen.getByText(/Cluster admin grant/i)).toBeInTheDocument();
    });
    // Модалка OK-кнопка: имеет exact text "Создать" (без " binding"); страница
    // header-кнопка — "Создать binding".
    const okBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "Создать");
    expect(okBtn).toBeTruthy();
    await act(async () => {
      await user.click(okBtn!);
    });
    await waitFor(() => {
      const alert = screen.getByTestId("access-bindings-create-error");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toMatch(
        /these permissions are already granted to usr-1 on cluster:cluster_kacho_root/i,
      );
    });
    // Модалка должна оставаться открытой.
    expect(screen.getByText(/Cluster admin grant/i)).toBeInTheDocument();
  });
});
