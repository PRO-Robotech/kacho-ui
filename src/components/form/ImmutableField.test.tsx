// src/components/form/ImmutableField.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ImmutableField } from "./ImmutableField";

describe("ImmutableField", () => {
  it("shows the value read-only with a lock affordance", () => {
    render(<ImmutableField value="enp1a2b3c4d5e6f7g8h" reason="Неизменяемо после создания" />);
    expect(screen.getByText("enp1a2b3c4d5e6f7g8h")).toBeInTheDocument();
    expect(screen.getByLabelText("immutable-lock")).toBeInTheDocument();
  });

  it("renders an em-dash placeholder for empty value", () => {
    render(<ImmutableField value="" reason="x" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
