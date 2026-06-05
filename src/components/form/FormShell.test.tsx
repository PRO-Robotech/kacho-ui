// src/components/form/FormShell.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FormShell } from "./FormShell";

describe("FormShell", () => {
  it("renders caps verb + singular heading and children", () => {
    render(
      <FormShell specId="subnets" mode="create" singular="Подсеть">
        <div>body</div>
      </FormShell>,
    );
    // caps-verb и заголовок-singular — отдельные узлы band-шапки.
    expect(screen.getByText("Создание")).toBeInTheDocument();
    expect(screen.getByText("Подсеть")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("uses the edit verb in edit mode", () => {
    render(
      <FormShell specId="subnets" mode="edit" singular="Подсеть">
        <div />
      </FormShell>,
    );
    expect(screen.getByText("Редактирование")).toBeInTheDocument();
    expect(screen.getByText("Подсеть")).toBeInTheDocument();
  });
});
