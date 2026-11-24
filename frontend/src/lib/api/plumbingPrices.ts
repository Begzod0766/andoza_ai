import { apiClient } from "./client";
import type { PlumbingPrices } from "../pipeCost";

/** The room's pipe and fitting prices (GET /rooms/{id}/plumbing-prices), the same ones the estimate uses. */
export function getPlumbingPrices(roomId: string): Promise<PlumbingPrices> {
  return apiClient<PlumbingPrices>(`/rooms/${roomId}/plumbing-prices`);
}
