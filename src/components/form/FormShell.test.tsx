// src/components/form/FormShell.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FormShell } from "./FormShell";

describe("FormShell", () => {
  it("renders verb title + singular and children", () => {
    render(
      <FormShell specId="subnets" mode="create" singular="Подсеть">
        <div>body</div>
      </FormShell>,
    );
    expect(screen.getByText(/Создание: Подсеть/)).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("uses the edit verb in edit mode", () => {
    render(
      <FormShell specId="subnets" mode="edit" singular="Подсеть">
        <div />
      </FormShell>,
    );
    expect(screen.getByText(/Редактирование: Подсеть/)).toBeInTheDocument();
  });
});
