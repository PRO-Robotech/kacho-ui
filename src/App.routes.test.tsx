// AppRoutes — integration-тест KAC-199: anonymous user не должен попадать
// на protected pages. RequireAuth должен заворачивать его на /auth/login
// при любой попытке зайти на dashboard / IAM / VPC / Compute / NLB / Admin.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppRoutes } from "./App";

let assignSpy: ReturnType<typeof vi.fn>;

function renderAt(path: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  assignSpy = vi.fn();
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      ...window.location,
      assign: assignSpy,
      pathname: "/",
      search: "",
      origin: "http://localhost:3000",
    },
  });
});

afterEach(() => vi.restoreAllMocks());

describe("AppRoutes — anonymous-user guard (KAC-199)", () => {
  function stubAnonymousFetch() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/iam/v1/auth/me")) return new Response("", { status: 401 });
        if (url.includes("/sessions/whoami")) return new Response("", { status: 401 });
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
  }

  // Каждый из этих paths — protected (Layout/AdminLayout/IamLayout).
  // Anonymous user должен видеть login page (LoginPage), а не protected
  // содержимое. Маркер LoginPage — у нас heading или title в /auth/login,
  // но проще — URL должен оказаться на /auth/login (через RequireAuth Navigate).
  const protectedPaths = [
    "/dashboard",
    "/projects/prj-x/vpc/networks",
    "/iam/accounts",
    "/iam/users",
  ];

  for (const path of protectedPaths) {
    it(`anonymous → ${path} → RequireAuth → редирект на Kratos login`, async () => {
      stubAnonymousFetch();
      renderAt(path);

      // Flow: RequireAuth видит user=null → <Navigate to="/auth/login?return_to=..."/>
      // → MemoryRouter переключает URL → LoginPage useEffect (no `?flow=`
      // param) → window.location.assign(kratos.loginUrl(returnTo)).
      //
      // Поэтому assignSpy ДОЛЖЕН быть вызван с URL, который ведёт на
      // Kratos self-service login init. Если бы RequireAuth НЕ была
      // подключена в AppRoutes (Bug #2), то Layout рендерился бы для
      // anonymous user, и assignSpy остался бы untouched.
      await waitFor(
        () => {
          expect(assignSpy).toHaveBeenCalled();
        },
        { timeout: 2000 },
      );
      const target = String(assignSpy.mock.calls[0]?.[0] ?? "");
      expect(target.toLowerCase()).toContain("login");
    });
  }

  it("public route /auth/login доступен без аутентификации (без redirect-loop)", async () => {
    stubAnonymousFetch();
    renderAt("/auth/login");
    // LoginPage стартует — она сама редиректит на Kratos flow init (нет ?flow=).
    // Это OK для public-route: один-разовый redirect на Kratos, не loop через
    // RequireAuth → /auth/login → … . Проверяем что assign вызван РОВНО
    // ОДИН раз (если бы RequireAuth перехватила /auth/login, был бы повторный).
    await waitFor(() => expect(assignSpy).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });

  it("public route /auth/callback доступен без аутентификации (KAC-199 — нет redirect-loop callback↔login)", async () => {
    stubAnonymousFetch();
    renderAt("/auth/callback");
    // AuthCallback показывает Spin → потом navigate('/') через setTimeout.
    // Главное: RequireAuth не должна перехватить /auth/callback — иначе
    // Kratos OIDC return_to landing превратится в бесконечный loop
    // (callback → login → kratos → callback → login → …).
    // Проверка: assignSpy НЕ вызван (AuthCallback на success делает
    // SPA-navigate, не location.assign).
    await new Promise((r) => setTimeout(r, 100));
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
