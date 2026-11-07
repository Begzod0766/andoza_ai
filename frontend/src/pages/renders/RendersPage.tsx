import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, ImageOff, X } from "lucide-react";
import { listAllRenders, type SavedRenderWithRoom } from "@/lib/api";
import { intlLocale } from "@/i18n";
import { Panel } from "@/components/ui/Panel";

const PAGE = 24;

/**
 * "Renderlarim": every room's renders in one gallery. They used to be reachable only room by room,
 * from the studio's "My renders" button. Newest first, a page at a time ("show more"), each with its
 * room's name and date; a tap opens it large, to download or to go to its room.
 */
export default function RendersPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<SavedRenderWithRoom | null>(null);
  const renders = useInfiniteQuery({
    queryKey: ["renders", "all"],
    queryFn: ({ pageParam }) => listAllRenders(pageParam, PAGE),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.has_more ? pages.length * PAGE : undefined),
  });
  const items = renders.data?.pages.flatMap((p) => p.items) ?? [];
  const date = (iso: string) => new Date(iso).toLocaleDateString(intlLocale());
  const roomName = (r: SavedRenderWithRoom) => r.room_name ?? t("renders.xona_nomsiz");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6">
      <h1 className="mb-1 text-2xl font-extrabold text-ink">{t("renders.sarlavha")}</h1>
      <p className="mb-5 text-sm text-ink-muted">{t("renders.izoh")}</p>

      {renders.isLoading && <p className="text-sm text-ink-muted">{t("common.yuklanmoqda")}</p>}
      {renders.isError && <p role="alert" className="text-sm text-red-500">{t("renders.xato")}</p>}

      {renders.isSuccess && items.length === 0 && (
        <Panel className="flex flex-col items-center gap-2 p-8 text-center">
          <ImageOff size={28} className="text-ink-muted" aria-hidden="true" />
          <p className="font-semibold text-ink">{t("renders.bosh")}</p>
          <p className="text-sm text-ink-muted">{t("renders.bosh_izoh")}</p>
        </Panel>
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpen(r)}
                aria-label={`${roomName(r)}, ${date(r.created_at)}`}
                className="group block w-full overflow-hidden rounded-2xl border border-line bg-card text-left shadow-panel"
              >
                <img src={r.url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]" />
                <span className="block px-3 py-2">
                  <span className="block truncate text-sm font-semibold text-ink">{roomName(r)}</span>
                  <span className="block text-xs text-ink-muted">{date(r.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {renders.hasNextPage && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => void renders.fetchNextPage()}
            disabled={renders.isFetchingNextPage}
            className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-ink hover:border-brand-light hover:text-accent disabled:opacity-60"
          >
            {renders.isFetchingNextPage ? t("common.yuklanmoqda") : t("renders.koproq")}
          </button>
        </div>
      )}

      <Dialog.Root open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,960px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-card shadow-panel outline-none"
          >
            {open && (
              <>
                <img src={open.url} alt={roomName(open)} className="max-h-[70vh] w-full bg-black object-contain" />
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <Dialog.Title className="mr-auto min-w-0 truncate text-sm font-semibold text-ink">
                    {roomName(open)} · {date(open.created_at)}
                  </Dialog.Title>
                  <a
                    href={open.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand-light"
                  >
                    <Download size={14} aria-hidden="true" />
                    {t("renders.yuklab_olish")}
                  </a>
                  {open.room_id && (
                    <Link
                      to={`/studio/${open.room_id}/ichkarida`}
                      className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90"
                    >
                      {t("renders.xonaga_otish")}
                    </Link>
                  )}
                  <Dialog.Close aria-label={t("common.yopish")} className="rounded-full p-1.5 text-ink-muted hover:bg-card-soft">
                    <X size={18} aria-hidden="true" />
                  </Dialog.Close>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
