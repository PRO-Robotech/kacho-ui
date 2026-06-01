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

  it("hides editHidden field in edit mode but shows normal fields", () => {
    const specWithSecret = {
      id: "things",
      singular: "Вещь",
      fields: [
        { name: "name", label: "Имя", type: "string" },
        { name: "secret", label: "Секрет", type: "string", editHidden: true },
      ],
    } as unknown as ResourceSpec;

    render(
      <ResourceFormBody
        spec={specWithSecret} mode="edit" obj={{ name: "n", secret: "x" }} onChange={() => {}}
        submitLabel="Сохранить" submitting={false} onSubmit={() => {}} onCancel={() => {}}
      />,
    );
    expect(screen.queryByText("Секрет")).not.toBeInTheDocument();
    expect(screen.getByText("Имя")).toBeInTheDocument();
  });

  it("hides visibleWhen field when discriminator does not match", () => {
    const specWithGated = {
      id: "addresses",
      singular: "Адрес",
      fields: [
        { name: "_kind", label: "Тип", type: "enum", options: [{ value: "external", label: "Внешний" }, { value: "internal", label: "Внутренний" }] },
        { name: "subnet_id", label: "Подсеть", type: "string", visibleWhen: { field: "_kind", equals: "internal" } },
      ],
    } as unknown as ResourceSpec;

    // _kind = "external" → visibleWhen({ field: "_kind", equals: "internal" }) is false → Подсеть hidden
    render(
      <ResourceFormBody
        spec={specWithGated} mode="create" obj={{ _kind: "external" }} onChange={() => {}}
        submitLabel="Создать адрес" submitting={false} onSubmit={() => {}} onCancel={() => {}}
      />,
    );
    expect(screen.queryByText("Подсеть")).not.toBeInTheDocument();
    expect(screen.getByText("Тип")).toBeInTheDocument();
  });
});
