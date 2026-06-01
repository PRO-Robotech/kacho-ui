// src/components/form/FormFooter.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FormFooter } from "./FormFooter";

describe("FormFooter", () => {
  it("calls onSubmit on primary click", async () => {
    const onSubmit = vi.fn();
    render(<FormFooter submitLabel="Создать сеть" submitting={false} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Создать сеть" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("disables both actions while submitting", () => {
    render(<FormFooter submitLabel="Создать сеть" submitting onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: "Отменить" })).toBeDisabled();
  });
});
