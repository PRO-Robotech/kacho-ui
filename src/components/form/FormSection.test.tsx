// src/components/form/FormSection.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { FormSection } from "./FormSection";

describe("FormSection", () => {
  it("renders a title and its children", () => {
    render(<FormSection title="Сеть"><div>child</div></FormSection>);
    expect(screen.getByText("Сеть")).toBeInTheDocument();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("collapses children when collapsible + defaultOpen=false", async () => {
    render(<FormSection title="Расширенное" collapsible defaultOpen={false}><div>hidden</div></FormSection>);
    expect(screen.queryByText("hidden")).toBeNull();
    await userEvent.click(screen.getByText("Расширенное"));
    expect(screen.getByText("hidden")).toBeInTheDocument();
  });
});
