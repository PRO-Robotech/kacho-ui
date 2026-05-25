// ServiceSidebar — KAC-199: sidebar "Войти" button должна стартовать
// Kratos self-service login (full-page redirect), а НЕ делать SPA
// navigate("/login") на несуществующий route.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ServiceSidebar } from "./ServiceSidebar";
import { AuthProvider } from "@/contexts/AuthContext";

const assignSpy = vi.fn();

beforeEach(() => {
  assignSpy.mockReset();
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      ...window.location,
      assign: assignSpy,
      pathname: "/dashboard",
      search: "",
      origin: "http://localhost:3000",
      href: "http://localhost:3000/dashboard",
    },
  });
});

afterEach(() => vi.restoreAllMocks());

describe("ServiceSidebar — SidebarUserButton (anonymous)", () => {
  it("KAC-199: click 'Войти' → full-page redirect на Kratos login URL (НЕ SPA navigate)", async () => {
    // user=null fetch stubs
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/iam/v1/auth/me")) return new Response("", { status: 401 });
        if (url.includes("/sessions/whoami")) return new Response("", { status: 401 });
        return new Response("", { status: 200 });
      }),
    );

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <ServiceSidebar />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Войти button рендерится когда user=null и loading завершён.
    const btn = await screen.findByLabelText("Войти");

    await userEvent.click(btn);

    // login() → window.location.assign(kratos.loginUrl(returnTo))
    // — это full-page redirect, не SPA navigate. assign должен быть вызван.
    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalled();
    });
    // URL должен идти на Kratos self-service login flow init endpoint
    // (defaults в kratos.ts → /.ory/kratos/public/self-service/login/browser?...)
    const target = String(assignSpy.mock.calls[0]?.[0] ?? "");
    expect(target).toMatch(/login/i);
    // НЕ SPA `/login` (если был bug — navigate сделал бы pushState на /login,
    // assign бы не вызвался вовсе).
    expect(target).not.toBe("/login");
  });
});
