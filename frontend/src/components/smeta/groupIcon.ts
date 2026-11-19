import { Armchair, Droplets, Grid3x3, Hammer, Layers, LayoutGrid, Package, PaintRoller, Zap, type LucideIcon } from "lucide-react";
import type { GroupKey } from "@/lib/smetaGroups";

/** Each estimate section's icon: on its header, and in place of a photo on a line that has none. */
export const GROUP_ICON: Record<GroupKey, LucideIcon> = {
  tayyorlash: Hammer,
  pardoz: PaintRoller,
  pol: Grid3x3,
  plitka_ish: LayoutGrid,
  shift: Layers,
  elektr: Zap,
  santexnika: Droplets,
  jihoz: Armchair,
  boshqa: Package,
};
