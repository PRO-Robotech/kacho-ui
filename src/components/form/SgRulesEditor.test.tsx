// SgRulesEditor — SG-target picker фильтрует по той же сети (KAC-243, scenario
// SG-NET-18-UI-RULE-PICKER-SAME-NETWORK).
//
// Когда у правила выбран target-kind "Security Group", picker target-SG должен
// показывать ТОЛЬКО SG из той же сети, что и редактируемая SG (editingNetworkId).
// SG из другой сети (физически изолированы) не selectable. Источник списка —
// SecurityGroupService.List (GET /vpc/v1/securityGroups?project_id=…) с
// клиентской фильтрацией refFilter (row.network_id === editingNetworkId).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { SgRulesEditor } from "./SgRulesEditor";
import { contextApi } from "@/lib/context-store";

const NET_A = "enpaaaaaaaaaaaaaaaa";
const NET_B = "enpbbbbbbbbbbbbbbbb";

function setupFetch() {
  // grpc-gateway отдаёт camelCase; api-client конвертит в snake_case на приёме.
  const f = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/vpc/v1/securityGroups")) {
      return new Response(
        JSON.stringify({
          securityGroups: [
            { id: "enpsame00000000001", name: "sg-target-A", networkId: NET_A },
            { id: "enpother0000000001", name: "sg-target-B", networkId: NET_B },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", f);
  return f;
}

function renderEditor(editingNetworkId?: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  // Один SG-target rule, раскрытый: target-kind = "sg".
  const value = {
    rules: [{ direction: "INGRESS", _target_kind: "sg", security_group_id: "" }],
  };
  return render(
    <ConfigProvider>
      <QueryClientProvider client={qc}>
        <SgRulesEditor
          pathPrefix=""
          value={value}
          onChange={() => {}}
          path="rules"
          editingNetworkId={editingNetworkId}
        />
      </QueryClientProvider>
    </ConfigProvider>,
  );
}

beforeEach(() => {
  // RefSelect refProjectScoped — нужен выбранный проект в context-store.
  contextApi.setProject({ id: "prjtest0000000001", name: "p", accountId: "acc" });
});
afterEach(() => {
  vi.restoreAllMocks();
  contextApi.setProject(null);
});

// Раскрываем единственное правило (Collapse по умолчанию свёрнут → RuleBody с
// picker'ом не смонтирован). Кликаем по заголовку панели.
function expandRule(container: HTMLElement) {
  const header = container.querySelector<HTMLElement>(".ant-collapse-header");
  if (!header) throw new Error("collapse header not found");
  fireEvent.click(header);
}

describe("SgRulesEditor SG-target picker (KAC-243 scenario 18)", () => {
  it("показывает только SG из той же сети (same-network filter)", async () => {
    setupFetch();
    const { container } = renderEditor(NET_A);
    expandRule(container);
    // SG из той же сети (NET_A) присутствует как опция.
    await waitFor(
      () => {
        expect(screen.getByRole("option", { name: /sg-target-A/ })).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
    // SG из другой сети (NET_B) отфильтрована — не selectable.
    expect(screen.queryByRole("option", { name: /sg-target-B/ })).not.toBeInTheDocument();
  });

  it("без network-контекста (editingNetworkId пуст) — fallback на ручной ввод UUID", () => {
    setupFetch();
    const { container } = renderEditor(undefined);
    expandRule(container);
    // Нет RefSelect-фильтра — рендерится текстовый input UUID.
    expect(screen.getByPlaceholderText("UUID другой SG")).toBeInTheDocument();
  });
});
