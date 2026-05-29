// ResourceListPage — NLB list payloadKey regression (KAC-226).
//
// Баг: registry-спека "load-balancers" имела payloadKey "load_balancers",
// тогда как proto-ответ ListNetworkLoadBalancersResponse несёт repeated-поле
// `network_load_balancers` (на проводе `networkLoadBalancers` → после
// camelToSnake `network_load_balancers`). ResourceListPage читает
// `data[spec.payloadKey]` → undefined → список всегда пуст, хотя backend
// вернул NLB. Тест RED до фикса payloadKey.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { ResourceListPage } from "./ResourceListPage";
import { PageHeaderSlotProvider } from "./PageHeaderSlot";
import { REGISTRY } from "@/lib/resource-registry";

function setupFetch() {
  const f = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/nlb/v1/networkLoadBalancers")) {
      // Backend (grpc-gateway) шлёт camelCase repeated-поле network_load_balancers.
      return new Response(
        JSON.stringify({
          networkLoadBalancers: [
            {
              id: "nlbtest000000000001",
              name: "my-nlb",
              region_id: "ru-central1",
              status: "ACTIVE",
              created_at: "2026-05-29T10:00:00Z",
              labels: {},
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // zones-фильтр и прочее — пусто.
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", f);
  return f;
}

function renderLBList() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <ConfigProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/projects/prjtest0000000001/nlb/load-balancers"]}>
          <PageHeaderSlotProvider>
            <Routes>
              <Route
                path="/projects/:projectId/nlb/load-balancers"
                element={
                  <ResourceListPage
                    spec={REGISTRY["load-balancers"]}
                    parentField="project_id"
                    parentParam="projectId"
                  />
                }
              />
            </Routes>
          </PageHeaderSlotProvider>
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

describe("ResourceListPage — NLB list (KAC-226)", () => {
  it("рендерит NLB из ответного поля network_load_balancers", async () => {
    setupFetch();
    renderLBList();
    await waitFor(
      () => {
        expect(screen.getByText("my-nlb")).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });
});
