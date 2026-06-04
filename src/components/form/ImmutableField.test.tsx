// src/components/form/ImmutableField.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ImmutableField } from "./ImmutableField";

describe("ImmutableField", () => {
  it("shows the value as a disabled input with a lock affordance", () => {
    render(<ImmutableField value="enp1a2b3c4d5e6f7g8h" reason="Неизменяемо после создания" />);
    const input = screen.getByDisplayValue("enp1a2b3c4d5e6f7g8h") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(screen.getByLabelText("immutable-lock")).toBeInTheDocument();
  });

  it("renders an em-dash placeholder for empty value", () => {
    render(<ImmutableField value="" reason="x" />);
    expect(screen.getByPlaceholderText("—")).toBeInTheDocument();
  });
});
