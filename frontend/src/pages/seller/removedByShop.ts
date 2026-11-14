import type { Wallpaper } from "@/lib/api";

/** The note the server leaves on an approved wallpaper its shop removed (app/routers/seller wallpapers). */
export const REMOVED_BY_SHOP_NOTE = "Do'kon olib tashladi";

/** A wallpaper the shop took down itself: kept as rejected, but not an admin's refusal. */
export function isRemovedByShop(w: Pick<Wallpaper, "status" | "moderation_note">): boolean {
  return w.status === "rejected" && w.moderation_note === REMOVED_BY_SHOP_NOTE;
}
