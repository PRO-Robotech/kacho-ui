// usePermissions / RequirePermission / DisabledIfNot unit-tests
// (KAC items 1-5 Foundation).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import {
  buildSnapshot,
  mapApiErrorToMessage,
  isAlreadyExistsError,
  isPermissionDeniedError,
  RequirePermission,
  DisabledIfNot,
  usePermissions,
} from "./permissions";
import { AuthProvider } from "@/contexts/AuthContext";
import { ApiError } from "@/api/client";

// ----- buildSnapshot pure-function tests -----

describe("buildSnapshot", () => {
  it("whoami=null + loading=true → loaded=false (UI должен показать Spin)", () => {
    const s = buildSnapshot(null, true);
    expect(s.loaded).toBe(false);
    expect(s.isSystemAdmin).toBe(false);
  });

  it("whoami=null + loading=false → loaded=true, isSystemAdmin=false", () => {
    const s = buildSnapshot(null, false);
    expect(s.loaded).toBe(true);
    expect(s.isSystemAdmin).toBe(false);
    expect(s.accounts).toEqual([]);
  });

  it("system_admin=true → isSystemAdmin=true", () => {
    const s = buildSnapshot(
      {
        subject: "user:usr-1",
        user_id: "usr-1",
        system_admin: true,
        cluster_viewer: true,
        accounts: [],
      },
      false,
    );
    expect(s.isSystemAdmin).toBe(true);
    expect(s.isClusterViewer).toBe(true);
  });

  it("hasAccountRole — true для точного match", () => {
    const s = buildSnapshot(
      {
        subject: "user:usr-1",
        system_admin: false,
        cluster_viewer: false,
        accounts: [
          { account_id: "acc-1", account_name: "Acme", roles: ["roles/editor"] },
        ],
      },
      false,
    );
    expect(s.hasAccountRole("acc-1", "roles/editor")).toBe(true);
    expect(s.hasAccountRole("acc-1", "roles/viewer")).toBe(false);
    expect(s.hasAccountRole("acc-999", "roles/editor")).toBe(false);
  });

  it("hasAccountRole — match по короткому имени (suffix)", () => {
    const s = buildSnapshot(
      {
        subject: "user:usr-1",
        system_admin: false,
        cluster_viewer: false,
        accounts: [
          { account_id: "acc-1", account_name: "Acme", roles: ["roles/admin"] },
        ],
      },
      false,
    );
    // backend может вернуть либо "roles/admin", либо просто "admin" — оба
    // считаются match-ем.
    expect(s.hasAccountRole("acc-1", "admin")).toBe(true);
  });

  it("isMemberOfAccount — true только для known account'ов", () => {
    const s = buildSnapshot(
      {
        subject: "user:usr-1",
        system_admin: false,
        cluster_viewer: false,
        accounts: [{ account_id: "acc-1", account_name: "A", roles: [] }],
      },
      false,
    );
    expect(s.isMemberOfAccount("acc-1")).toBe(true);
    expect(s.isMemberOfAccount("acc-2")).toBe(false);
  });
});

// ----- mapApiErrorToMessage tests (KAC item #4 rich deny_reasons) -----

describe("mapApiErrorToMessage", () => {
  it("non-ApiError → fallback на Error.message", () => {
    expect(mapApiErrorToMessage(new Error("boom"))).toBe("boom");
    expect(mapApiErrorToMessage("plain string")).toBe("plain string");
  });

  it("ApiError без details → возвращает err.message", () => {
    const e = new ApiError(403, "7", null, "Permission denied");
    expect(mapApiErrorToMessage(e)).toBe("Permission denied");
  });

  it("ApiError с deny_reasons → join их messages", () => {
    const e = new ApiError(403, "7", [
      {
        "@type": "google.rpc.ErrorInfo",
        metadata: {
          deny_reasons: [
            { reason: "missing_relation", message: "User не admin@cluster" },
            { reason: "wrong_account", message: "Token из другого account'а" },
          ],
        },
      },
    ], "Permission denied");
    expect(mapApiErrorToMessage(e)).toBe(
      "User не admin@cluster; Token из другого account'а",
    );
  });

  it("ApiError 403 без details / message → дефолтное сообщение", () => {
    const e = new ApiError(403, "7", null, "");
    expect(mapApiErrorToMessage(e)).toBe("Permission denied");
  });
});

describe("isAlreadyExistsError / isPermissionDeniedError", () => {
  it("ApiError(409) → AlreadyExists", () => {
    expect(isAlreadyExistsError(new ApiError(409, "6", null, "dup"))).toBe(true);
    expect(isAlreadyExistsError(new ApiError(409, "ALREADY_EXISTS", null, "dup")))
      .toBe(true);
  });
  it("ApiError(other) → not AlreadyExists", () => {
    expect(isAlreadyExistsError(new ApiError(400, "3", null, "bad"))).toBe(false);
    expect(isAlreadyExistsError(new Error("x"))).toBe(false);
  });
  it("ApiError(403) → PermissionDenied", () => {
    expect(isPermissionDeniedError(new ApiError(403, "7", null, "x"))).toBe(true);
  });
  it("ApiError(404) → not PermissionDenied", () => {
    expect(isPermissionDeniedError(new ApiError(404, "5", null, "x"))).toBe(false);
  });
});

// ----- <RequirePermission> tests -----

function whoamiFetchMock(opts: {
  systemAdmin?: boolean;
  clusterViewer?: boolean;
  accounts?: Array<{ account_id: string; account_name: string; roles: string[] }>;
}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/iam/v1/me")) {
      return new Response(
        JSON.stringify({
          subject: "user:usr-1",
          user_id: "usr-1",
          email: "u@kacho.cloud",
          systemAdmin: opts.systemAdmin ?? false,
          clusterViewer: opts.clusterViewer ?? false,
          accounts: (opts.accounts ?? []).map((a) => ({
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
    return new Response("", { status: 200 });
  });
}

beforeEach(() => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, assign: vi.fn(), pathname: "/", search: "" },
  });
});

afterEach(() => vi.restoreAllMocks());

describe("RequirePermission", () => {
  it("user НЕ admin → child скрыт, fallback render", async () => {
    vi.stubGlobal("fetch", whoamiFetchMock({ systemAdmin: false }));
    render(
      <AuthProvider>
        <RequirePermission
          check={(p) => p.isSystemAdmin}
          fallback={<div data-testid="fb">не-admin</div>}
        >
          <div data-testid="ok">admin-only</div>
        </RequirePermission>
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("fb")).toBeInTheDocument();
      expect(screen.queryByTestId("ok")).not.toBeInTheDocument();
    });
  });

  it("user admin → child render", async () => {
    vi.stubGlobal("fetch", whoamiFetchMock({ systemAdmin: true }));
    render(
      <AuthProvider>
        <RequirePermission check={(p) => p.isSystemAdmin}>
          <div data-testid="ok">admin-only</div>
        </RequirePermission>
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("ok")).toBeInTheDocument();
    });
  });
});

describe("DisabledIfNot", () => {
  it("user без permission → child обёрнут в disabled + tooltip span", async () => {
    vi.stubGlobal("fetch", whoamiFetchMock({ systemAdmin: false }));
    render(
      <AuthProvider>
        <DisabledIfNot check={(p) => p.isSystemAdmin} reason="Требуется system_admin">
          <button data-testid="btn">Удалить</button>
        </DisabledIfNot>
      </AuthProvider>,
    );
    await waitFor(() => {
      const btn = screen.getByTestId("btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  it("user с permission → child render как есть", async () => {
    vi.stubGlobal("fetch", whoamiFetchMock({ systemAdmin: true }));
    render(
      <AuthProvider>
        <DisabledIfNot check={(p) => p.isSystemAdmin} reason="-">
          <button data-testid="btn">Удалить</button>
        </DisabledIfNot>
      </AuthProvider>,
    );
    await waitFor(() => {
      const btn = screen.getByTestId("btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
  });
});

describe("usePermissions hook", () => {
  it("через AuthProvider — после whoami load возвращает snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      whoamiFetchMock({
        systemAdmin: true,
        accounts: [{ account_id: "acc-1", account_name: "A", roles: ["roles/editor"] }],
      }),
    );
    function Probe() {
      const p = usePermissions();
      return (
        <div>
          <span data-testid="loaded">{p.loaded ? "y" : "n"}</span>
          <span data-testid="sa">{p.isSystemAdmin ? "y" : "n"}</span>
          <span data-testid="role">{p.hasAccountRole("acc-1", "roles/editor") ? "y" : "n"}</span>
        </div>
      );
    }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("loaded")).toHaveTextContent("y");
      expect(screen.getByTestId("sa")).toHaveTextContent("y");
      expect(screen.getByTestId("role")).toHaveTextContent("y");
    });
  });
});
