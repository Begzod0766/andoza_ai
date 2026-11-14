import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NormsTab } from "./NormsTab";

const api = vi.hoisted(() => ({
  listAdminNorms: vi.fn(),
  setAdminNorm: vi.fn(),
  resetAdminNorm: vi.fn(),
  listAdminNormLog: vi.fn(),
}));
vi.mock("@/lib/api/adminNorms", () => api);

const TRAP = { file: "plumbing", path: "part_uzs.trap_pol", label: "Pol trapi", unit: "so'm/dona", group: "Santexnika: qismlar", default: 450000, value: 380000, overridden: true, updated_at: null };
const KRAN = { file: "plumbing", path: "part_uzs.kran_kir", label: "Kir yuvish mashinasi krani", unit: "so'm/dona", group: "Santexnika: qismlar", default: 60000, value: 60000, overridden: false, updated_at: null };
const GROUT = { file: "tile", path: "grout_kg_m2", label: "Zatirka sarfi", unit: "kg/m²", group: "Plitka va gidroizolyatsiya", default: 0.4, value: 0.4, overridden: false, updated_at: null };

function renderTab(onError = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><NormsTab onError={onError} /></QueryClientProvider>);
  return onError;
}
const row = (label: string) => screen.getByRole("row", { name: new RegExp(label) });

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.listAdminNorms.mockResolvedValue({ entries: [TRAP, KRAN, GROUT] });
  api.listAdminNormLog.mockResolvedValue({ items: [{ file: "plumbing", path: "part_uzs.trap_pol", label: "Pol trapi", old_value: null, new_value: 380000, user_id: null, created_at: "2026-11-15T12:00:00Z" }] });
});

describe("NormsTab", () => {
  it("lists the prices by group with their unit, value and default; a changed one is marked", async () => {
    renderTab();
    await screen.findByRole("row", { name: /Pol trapi/ });
    expect(screen.getByRole("heading", { name: "Santexnika: qismlar" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Plitka va gidroizolyatsiya" })).toBeTruthy();
    expect((within(row("Pol trapi")).getByRole("spinbutton") as HTMLInputElement).value).toBe("380000");
    expect(row("Pol trapi")).toHaveTextContent("so'm/dona");
    expect(row("Pol trapi")).toHaveTextContent(/asl: 450.000/);
    expect(within(row("Pol trapi")).getByRole("button", { name: "Asl holiga" })).toBeTruthy();
    expect(within(row("Kir yuvish mashinasi krani")).queryByRole("button", { name: "Asl holiga" })).toBeNull();
  });

  it("a new value is saved when the field is left, and only when it changed", async () => {
    api.setAdminNorm.mockResolvedValue({ ...KRAN, value: 65000, overridden: true });
    renderTab();
    const input = within(await screen.findByRole("row", { name: /Kir yuvish mashinasi krani/ })).getByRole("spinbutton");
    fireEvent.blur(input);
    expect(api.setAdminNorm).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "65000" } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.setAdminNorm).toHaveBeenCalledWith("plumbing", "part_uzs.kran_kir", 65000));
  });

  it("Enter saves too; a decimal rate is kept as it is", async () => {
    api.setAdminNorm.mockResolvedValue({ ...GROUT, value: 0.45, overridden: true });
    renderTab();
    const input = within(await screen.findByRole("row", { name: /Zatirka sarfi/ })).getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "0.45" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(api.setAdminNorm).toHaveBeenCalledWith("tile", "grout_kg_m2", 0.45));
  });

  it("a refused value shows the server's reason", async () => {
    api.setAdminNorm.mockRejectedValue(Object.assign(new Error("0 dan katta bo'lishi kerak"), { status: 422, detail: "0 dan katta bo'lishi kerak" }));
    const onError = renderTab();
    const input = within(await screen.findByRole("row", { name: /Kir yuvish mashinasi krani/ })).getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    await waitFor(() => expect(onError).toHaveBeenLastCalledWith(expect.anything()));
    expect(onError.mock.calls.at(-1)![0]).not.toBeNull();
  });

  it("Asl holiga puts the file's value back", async () => {
    api.resetAdminNorm.mockResolvedValue({ ...TRAP, value: 450000, overridden: false });
    renderTab();
    fireEvent.click(within(await screen.findByRole("row", { name: /Pol trapi/ })).getByRole("button", { name: "Asl holiga" }));
    await waitFor(() => expect(api.resetAdminNorm).toHaveBeenCalledWith("plumbing", "part_uzs.trap_pol"));
  });

  it("the search keeps the rows whose name matches", async () => {
    renderTab();
    await screen.findByRole("row", { name: /Pol trapi/ });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zatirka" } });
    expect(screen.queryByRole("row", { name: /Pol trapi/ })).toBeNull();
    expect(screen.getByRole("row", { name: /Zatirka sarfi/ })).toBeTruthy();
  });

  it("the last changes are listed", async () => {
    renderTab();
    const log = await screen.findByRole("list", { name: "Oxirgi o'zgarishlar" });
    await waitFor(() => expect(log).toHaveTextContent("Pol trapi"));
    expect(log).toHaveTextContent(/asl → 380.000/);
  });
});
