// AccessBindingsPage — RBAC v2 adaptation tests (KAC-224).
//
// Покрывает два UI-пробела, выявленных аудитом адаптации под RBAC v2
// (эпик KAC-214):
//
//   1. scope-колонка. RBAC v2 добавил AccessBinding.scope
//      (CLUSTER/ACCOUNT/PROJECT, proto field 15, output-only). Backend toproto
//      эмитит его на каждом ответе. UI должен показывать scope read-only.
//   2. Мёртвые resource_type folder/organization/cloud (эра resource-manager,
//      удалены KAC-124 / KAC-223). RESOURCE_TYPES обязан предлагать только
//      account/project/cluster — иначе backend → INVALID_ARGUMENT
//      "Illegal argument resource_type".
//
// Эти тесты RED до имплементации KAC-224 (scope не в типе/таблице;
// RESOURCE_TYPES не экспортирован и содержит мёртвые типы).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { AccessBindingsPage, RESOURCE_TYPES } from "./AccessBindingsPage";
import { AuthProvider } from "@/contexts/AuthContext";

/** Один scoped binding для текущего user'а — отдаётся через listBySubject. */
const SCOPED_BINDING = {
  id: "acb-scoped-1",
  subjectType: "user",
  subjectId: "usr-1",
  roleId: "roles/admin",
  resourceType: "account",
  resourceId: "acc-1",
  scope: "ACCOUNT",
  createdAt: "2026-05-29T10:00:00Z",
};

function setupFetch() {
  const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/iam/v1/me") && !url.includes("auth")) {
      return new Response(
        JSON.stringify({
          subject: "user:usr-1",
          userId: "usr-1",
          email: "a@kacho.cloud",
          systemAdmin: false,
          clusterViewer: false,
          accounts: [],
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

    // listBySubject (Мои AccessBinding'и) → один scoped binding.
    if (url.includes("/iam/v1/accessBindings:listBySubject")) {
      return new Response(JSON.stringify({ accessBindings: [SCOPED_BINDING] }), {
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
    if (url.includes("/iam/v1/accounts/") && url.includes("/accessBindings")) {
      return new Response(JSON.stringify({ accessBindings: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/iam/v1/accounts")) {
      return new Response(JSON.stringify({ accounts: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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
    void method;
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

describe("AccessBindingsPage — RBAC v2 scope (KAC-224)", () => {
  it("показывает scope ('ACCOUNT') из ответа AccessBinding в таблице 'Мои'", async () => {
    setupFetch();
    renderPage();
    // Scope-колонка должна отрендерить значение scope из binding'а.
    await waitFor(
      () => {
        expect(screen.getByText("ACCOUNT")).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });
});

describe("AccessBindingsPage — drop dead resource_type (KAC-224)", () => {
  it("RESOURCE_TYPES = account/project/cluster (без folder/organization/cloud)", () => {
    expect(RESOURCE_TYPES).toEqual(["account", "project", "cluster"]);
  });

  it("RESOURCE_TYPES не содержит legacy resource-manager типов", () => {
    expect(RESOURCE_TYPES).not.toContain("folder");
    expect(RESOURCE_TYPES).not.toContain("organization");
    expect(RESOURCE_TYPES).not.toContain("cloud");
  });
});
