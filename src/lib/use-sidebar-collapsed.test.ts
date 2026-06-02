// KAC-246: persist-логика collapse-состояния сайдбара.

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  SIDEBAR_COLLAPSED_KEY,
  readSidebarCollapsed,
  writeSidebarCollapsed,
  useSidebarCollapsed,
} from "./use-sidebar-collapsed";

beforeEach(() => {
  window.localStorage.clear();
});

describe("readSidebarCollapsed / writeSidebarCollapsed", () => {
  it("дефолт — развёрнут (false) без записи в storage", () => {
    expect(readSidebarCollapsed()).toBe(false);
  });

  it("write(true) → '1', read → true", () => {
    writeSidebarCollapsed(true);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
    expect(readSidebarCollapsed()).toBe(true);
  });

  it("write(false) → '0', read → false", () => {
    writeSidebarCollapsed(false);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("0");
    expect(readSidebarCollapsed()).toBe(false);
  });

  it("игнорирует мусорное значение → false", () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "yes");
    expect(readSidebarCollapsed()).toBe(false);
  });
});

describe("useSidebarCollapsed", () => {
  it("инициализируется из localStorage", () => {
    writeSidebarCollapsed(true);
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(true);
  });

  it("toggle переключает state и пишет в storage", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(false);

    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");

    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("0");
  });

  it("setCollapsed(true) синхронит state и storage", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current[2](true));
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
  });
});
