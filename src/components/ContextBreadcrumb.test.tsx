// KAC-246: account/project пилюли в шапке — клик ОБЯЗАН открывать дропдаун.
// Регресс-страж против forwardRef-бага: PillButton — кастомный компонент, и
// AntD Dropdown инжектит onClick/ref через cloneElement; без forwardRef+{...rest}
// клик проглатывается и меню не открывается. RED при откате forwardRef.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/api/iam", () => ({
  iamApi: {
    listAccounts: vi.fn(async () => ({ accounts: [{ id: "acctest1", name: "personal-cloud-test" }] })),
    listProjects: vi.fn(async () => ({ projects: [] })),
  },
}));

import { ContextBreadcrumb } from "./ContextBreadcrumb";
import { PageHeaderSlotProvider } from "./PageHeaderSlot";
import { contextApi } from "@/lib/context-store";

beforeEach(() => {
  contextApi.setAccount(null);
});

describe("ContextBreadcrumb — пилюли-дропдауны", () => {
  it("клик по пилюле «Аккаунт» открывает дропдаун со списком аккаунтов", async () => {
    render(
      <MemoryRouter>
        <PageHeaderSlotProvider>
          <ContextBreadcrumb />
        </PageHeaderSlotProvider>
      </MemoryRouter>,
    );

    // account null → пилюля показывает плейсхолдер-триггер.
    const pill = await screen.findByRole("button", { name: /Выберите аккаунт/ });

    await userEvent.click(pill);

    // Дропдаун открылся → пункт с именем аккаунта виден (рендерится в portal).
    // Если onClick не дошёл (forwardRef сломан) — меню не откроется, findByText упадёт.
    expect(await screen.findByText("personal-cloud-test")).toBeInTheDocument();
  });
});
