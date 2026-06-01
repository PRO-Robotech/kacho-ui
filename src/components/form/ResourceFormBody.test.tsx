// src/components/form/ResourceFormBody.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ResourceFormBody } from "./ResourceFormBody";
import type { ResourceSpec } from "@/lib/resource-registry";

const spec = {
  id: "networks",
  singular: "Сеть",
  fields: [
    { name: "name", label: "Имя", type: "string", required: true },
    { name: "network_id", label: "Сеть", type: "string", description: "родитель" },
  ],
} as unknown as ResourceSpec;

describe("ResourceFormBody", () => {
  it("renders create title + editable name field + footer", () => {
    render(
      <ResourceFormBody
        spec={spec} mode="create" obj={{ name: "n1" }} onChange={() => {}}
        submitLabel="Создать сеть" submitting={false} onSubmit={() => {}} onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/Создание: Сеть/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Создать сеть" })).toBeInTheDocument();
  });

  it("renders a locked field as read-only with a lock", () => {
    render(
      <ResourceFormBody
        spec={spec} mode="create" obj={{ name: "n1", network_id: "enpXYZ" }} onChange={() => {}}
        lockedPaths={new Set(["network_id"])}
        submitLabel="Создать сеть" submitting={false} onSubmit={() => {}} onCancel={() => {}}
      />,
    );
    expect(screen.getByText("enpXYZ")).toBeInTheDocument();
    expect(screen.getByLabelText("immutable-lock")).toBeInTheDocument();
  });
});
