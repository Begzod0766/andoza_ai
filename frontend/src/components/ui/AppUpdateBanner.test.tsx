import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/i18n";
import uz from "@/i18n/locales/uz.json";
import ru from "@/i18n/locales/ru.json";
import en from "@/i18n/locales/en.json";
import { appUpdate } from "@/lib/appUpdate";
import { onBeforeReload } from "@/lib/safeReload";
import { AppUpdateBanner } from "./AppUpdateBanner";

afterEach(() => act(() => appUpdate.reset()));

describe("AppUpdateBanner", () => {
  it("shows only once a new version is offered", () => {
    render(<AppUpdateBanner />);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => appUpdate.offer(vi.fn()));
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("app_update.banner"));
  });

  it("the button saves first, then updates", async () => {
    const apply = vi.fn();
    const order: string[] = [];
    const off = onBeforeReload(async () => { order.push("saved"); });
    apply.mockImplementation(() => order.push("applied"));
    render(<AppUpdateBanner />);
    act(() => appUpdate.offer(apply));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: i18n.t("app_update.apply") })); });
    expect(order).toEqual(["saved", "applied"]);
    off();
  });

  it("when the room could not be saved it does not update, and says so", async () => {
    const apply = vi.fn();
    const off = onBeforeReload(async () => false);
    render(<AppUpdateBanner />);
    act(() => appUpdate.offer(apply));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: i18n.t("app_update.apply") })); });
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("app_update.not_saved"));
    off();
  });

  it("has its texts in all three languages", () => {
    for (const l of [uz, ru, en] as Record<string, Record<string, string>>[]) {
      for (const k of ["banner", "apply", "not_saved"]) expect(l.app_update?.[k]).toBeTruthy();
    }
  });
});
