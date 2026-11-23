import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/i18n";
import uz from "@/i18n/locales/uz.json";
import ru from "@/i18n/locales/ru.json";
import en from "@/i18n/locales/en.json";
import { serverUpdating } from "@/lib/api/serverStatus";
import { ServerUpdatingBanner } from "./ServerUpdatingBanner";

afterEach(() => act(() => serverUpdating.set(false)));

describe("ServerUpdatingBanner", () => {
  it("shows only while the server is being updated", () => {
    render(<ServerUpdatingBanner />);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => serverUpdating.set(true));
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("server_updating.banner"));
    expect(screen.getByRole("button", { name: i18n.t("server_updating.retry") })).toBeInTheDocument();
    act(() => serverUpdating.set(false));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("has its texts in all three languages", () => {
    for (const l of [uz, ru, en] as Record<string, Record<string, string>>[]) {
      for (const k of ["banner", "retry", "error"]) expect(l.server_updating?.[k]).toBeTruthy();
    }
  });
});

describe("ServerUpdatingBanner retry", () => {
  it("saves the work before it reloads, and stays when it could not", async () => {
    const { onBeforeReload } = await import("@/lib/safeReload");
    const reload = vi.fn();
    const loc = vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
    const off = onBeforeReload(async () => false);
    render(<ServerUpdatingBanner />);
    act(() => serverUpdating.set(true));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: i18n.t("server_updating.retry") })); });
    expect(reload).not.toHaveBeenCalled();
    off();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: i18n.t("server_updating.retry") })); });
    expect(reload).toHaveBeenCalledTimes(1);
    loc.mockRestore();
  });
});
