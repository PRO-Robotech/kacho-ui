// src/components/form/FieldLabel.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FieldLabel } from "./FieldLabel";

describe("FieldLabel", () => {
  it("renders plain text when no info", () => {
    render(<FieldLabel text="Имя" />);
    expect(screen.getByText("Имя")).toBeInTheDocument();
    expect(screen.queryByLabelText("field-info")).toBeNull();
  });

  it("renders an info trigger when info is provided", () => {
    render(<FieldLabel text="Сеть" info="Сеть, к которой принадлежит подсеть" />);
    expect(screen.getByText("Сеть")).toBeInTheDocument();
    expect(screen.getByLabelText("field-info")).toBeInTheDocument();
  });
});
