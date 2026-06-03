// src/components/DeleteDialog.test.tsx
// KAC-246: высокорисковые ресурсы (networks/route-tables/security-groups) требуют
// ввода имени для подтверждения — danger-кнопка disabled, пока имя не совпало.
// Title содержит имя ресурса. Danger-кнопка — DopplerButton (pulse при pending).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { DeleteDialog } from "./DeleteDialog";

// Дерево связей не нужно для этих кейсов — отключаем resolver,
// чтобы не уходить в сеть.
vi.mock("@/lib/dependency-graph", () => ({
  hasDependencyResolver: () => false,
  loadDependents: vi.fn(async () => []),
}));

// useOperation/invalidate — no-op, чтобы не дёргать react-query polling.
vi.mock("@/lib/use-operation", () => ({
  useOperation: () => ({ data: undefined }),
  useInvalidateResourceList: () => vi.fn(),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ConfigProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ConfigProvider>,
  );
}

const base = {
  open: true,
  onOpenChange: () => {},
  apiPath: "/vpc/v1/networks/enp123",
  resourceId: "networks",
  resourceLabel: "Сеть",
  name: "prod-net",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("DeleteDialog", () => {
  it("показывает заголовок и имя ресурса в сообщении", () => {
    wrap(<DeleteDialog {...base} />);
    // KAC-246: empty-state-стиль — заголовок «Удалить <label>?» + имя в теле.
    expect(screen.getByText(/Удалить сеть\?/i)).toBeInTheDocument();
    expect(screen.getByText("prod-net")).toBeInTheDocument();
  });

  it("requireNameConfirm gates the danger button until the name matches", async () => {
    wrap(<DeleteDialog {...base} requireNameConfirm />);
    const del = screen.getByRole("button", { name: "Удалить" });
    expect(del).toBeDisabled();

    const input = screen.getByPlaceholderText("prod-net");
    await userEvent.type(input, "wrong");
    expect(del).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, "prod-net");
    expect(del).toBeEnabled();
  });

  it("without requireNameConfirm the danger button is enabled immediately", () => {
    wrap(<DeleteDialog {...base} />);
    expect(screen.getByRole("button", { name: "Удалить" })).toBeEnabled();
  });
});
