import { useState } from "react";
import { nanoid } from "nanoid";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "@/store/roomStore";
import { inferRole, ROLE_GROUP } from "@/lib/furnitureRole";
import { fitsCatalogRoom } from "@/lib/furnitureRoomFit";
import { catalogRoomType, effectiveRoomType } from "@/lib/roomType";
import { fixtureDisplayName } from "@/lib/fixtureName";
import { formatUZS } from "@/lib/utils";
import { nextFurnitureSpot } from "@/features/studio/nextFurnitureSpot";

const isPlumbing = (category: string | null | undefined, name: string) =>
  ROLE_GROUP[inferRole(category ?? null, name)] === "plumbing";

/**
 * The room's fixtures, with a picker that adds one from the plumbing catalog (QA 2026-11-18 #5).
 * In both plumbing stages: Quvurlar comes first, and its points are the fixtures' own, so the user
 * plans the fixtures there and then lays the pipes. Was: added only in Mebel, with its filter.
 * The pick goes where every "add" puts a piece (nextFurnitureSpot): against a wall, clear of the rest.
 */
export function PlumbingFixtures({ children, optional = false, title = true }: {
  /** Warnings under the list (the Jihozlar stage's clearances and hatch). */
  children?: React.ReactNode;
  /** Left out when the catalog has nothing to offer and nothing stands (a kitchen, QA 2026-11-18 K1). */
  optional?: boolean;
  /** Its «Jihozlar» heading; left out where the stage itself is called that (2026-11-23). */
  title?: boolean;
}) {
  const { t } = useTranslation();
  const furniture = useRoomStore((s) => s.furniture);
  const catalog = useRoomStore((s) => s.catalogFurniture);
  const userFurniture = useRoomStore((s) => s.userFurniture);
  const placeFurniture = useRoomStore((s) => s.placeFurniture);
  const removeFurniture = useRoomStore((s) => s.removeFurniture);
  const roomKind = useRoomStore((s) => catalogRoomType(effectiveRoomType(s.roomType, s.name)));
  const [open, setOpen] = useState(false);
  // A rail or machine is a fixture too, listed by the section around this (phone QA #392 2a).
  const hasMachines = useRoomStore((s) => s.towelRails.length + s.washers.length > 0);

  const byId = new Map(catalog.map((c) => [c.id, c]));
  const fixtures = furniture.flatMap((f) => {
    const row = byId.get(f.furniture_id);
    const name = row?.name_uz ?? userFurniture.find((e) => e.id === f.furniture_id)?.name ?? f.name ?? f.furniture_id;
    return isPlumbing(row?.category, name) ? [{ id: f.id, name: fixtureDisplayName(name, t) }] : [];
  });

  // The shop's plumbing models (for this room's kind, as Mebel offers them) and the user's own.
  const entries = [
    ...catalog.filter((c) => (!roomKind || fitsCatalogRoom(c, roomKind)) && isPlumbing(c.category, c.name_uz)).map((c) => ({
      id: c.id, name: c.name_uz, category: c.category as string | undefined, priceUzs: c.price_uzs ?? undefined,
      thumbnailUrl: c.thumbnail_url ?? undefined,
      sizeM: { w: (c.footprint_w ?? 0) / 100, d: (c.footprint_d ?? 0) / 100 },
      heightM: c.height_cm ? c.height_cm / 100 : undefined,
    })),
    ...userFurniture.filter((e) => isPlumbing(e.category, e.name)).map((e) => ({
      id: e.id, name: e.name, category: e.category as string | undefined, priceUzs: e.priceUzs, thumbnailUrl: undefined as string | undefined,
      sizeM: e.sizeM, heightM: undefined as number | undefined,
    })),
  ];

  if (optional && entries.length === 0 && fixtures.length === 0) return <>{children}</>;

  function add(e: (typeof entries)[number]) {
    placeFurniture({
      id: nanoid(), furniture_id: e.id,
      ...nextFurnitureSpot({ name: e.name, category: e.category, sizeM: e.sizeM, heightM: e.heightM }),
    });
  }

  return (
    <div>
      {title && <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-muted">{t("studio.santexnika.fixtures")}</span>}
      {fixtures.length === 0
        ? !hasMachines && <p className="text-[11px] text-ink-muted">{t("studio.santexnika.no_fixtures")}</p>
        : (
          <ul className="flex flex-wrap gap-1.5">
            {fixtures.map((f) => (
              <li key={f.id} className="flex items-center gap-1 rounded-full border border-line py-1 pl-2.5 pr-1.5 text-[11px] text-ink">
                {f.name}
                <button type="button" onClick={() => removeFurniture(f.id)} aria-label={t("studio.santexnika.remove_named", { name: f.name })}
                  className="-my-1 flex h-7 w-7 items-center justify-center rounded-full text-base leading-none text-ink-muted hover:text-red-500">×</button>
              </li>
            ))}
          </ul>
        )}
      {children}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="mt-2 w-full rounded-full border border-line py-2 text-[12px] font-semibold text-ink hover:border-brand/50 hover:text-accent">
        {t("studio.santexnika.add_fixture")}
      </button>
      {open && (entries.length === 0
        ? <p className="mt-1.5 text-[11px] text-ink-muted">{t("studio.santexnika.catalog_empty")}</p>
        : (
          <ul aria-label={t("studio.santexnika.catalog")} className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {entries.map((e) => {
              const count = furniture.filter((f) => f.furniture_id === e.id).length;
              return (
                <li key={e.id} className="flex items-center gap-2 rounded-lg border border-line bg-card px-2 py-1.5">
                  {e.thumbnailUrl
                    ? <img src={e.thumbnailUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                    : <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-md bg-card-soft" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-ink">{e.name}</span>
                    <span className="block text-[10px] text-ink-muted">
                      {e.priceUzs ? formatUZS(e.priceUzs) : null}
                      {count > 0 && <> · {t("studio.santexnika.placed_count", { count })}</>}
                    </span>
                  </span>
                  <button type="button" onClick={() => add(e)} aria-label={t("studio.santexnika.add_named", { name: e.name })}
                    className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand/90">+</button>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
