import * as Dialog from "@radix-ui/react-dialog"
import { useTranslation } from "react-i18next"

/** A still one of the fixed cameras has just taken. */
export interface ViewStill {
  blob: Blob
  /** An object URL of `blob`; whoever made it revokes it when the sheet closes. */
  url: string
  filename: string
  /** 1-based, for the title. */
  station: number
}

/**
 * The file a fixed camera's still is saved as: `<room>-cam<n>-<shape>.png`, e.g.
 * "Mening xonam-cam3-9x16.png", named by camera and shape so a set of four does
 * not overwrite itself.
 *
 * "cam" and not a translated word: it used to be the Uzbek "kamera" in every
 * language (Begzod0766/andoza_ai#180), and a file name outlives the session —
 * it is shared and kept, read in whatever language the reader has. A short
 * neutral tag reads the same everywhere and needs no keys. The room's name is
 * the user's own and stays as typed, less what a file name cannot hold
 * (/ \ : * ? " < > | and control characters, each run made one "-").
 */
export function viewStillFilename(roomName: string, station: number, aspectLabel: string): string {
  const room = roomName
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
  return `${room || "xona"}-cam${station}-${aspectLabel.replace(":", "x")}.png`
}

/**
 * Hands a picture to the user as a file, in the way the device can take it.
 *
 * The share sheet first, where the device offers one for files: it is how a
 * phone saves a picture ("Save Image" lands it in Photos), and it is the only
 * way that works inside the iOS app's WebView, which drops a link's `download`
 * on the floor. Everywhere else, the download link as before — but revoked a
 * while after the click rather than in the same tick, which Safari treats as
 * cancelling the download it was about to start.
 *
 * A dismissed share sheet is the user saying no, not a reason to try another
 * way: it comes back "cancelled" and nothing else happens.
 */
export async function saveStill(blob: Blob, filename: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: blob.type || "image/png" })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] })
      return "shared"
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return "cancelled"
      // Refused for another reason (not allowed here, say): the link may still work.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return "downloaded"
}

/**
 * The picture a fixed camera's "Render" took, on screen.
 *
 * It used to go straight to a download, which on the phone app was nothing at
 * all: no file, no sign anything had happened (QA 2026-11-05 re-check R2). The
 * picture is now always shown first, so the tap visibly did something, and it
 * is saved from here — by the button, or on a phone by holding the picture,
 * which the WebView answers with its own "Save to Photos".
 *
 * Laid out like the render sheet: a bottom sheet on a phone, a card on a wide
 * screen, over the studio's own overlays.
 */
export function ViewStillSheet({ still, onClose }: { still: ViewStill | null; onClose(): void }) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open={!!still} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className={[
            "fixed z-[80] bg-white shadow-2xl outline-none flex flex-col gap-4 px-6 pt-6 pb-6",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-[28px]",
            "sm:inset-0 sm:m-auto sm:h-fit sm:w-[min(92vw,560px)] sm:rounded-[28px]",
          ].join(" ")}
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">
                {t("render.kadr.sarlavha", { n: still?.station ?? 1 })}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm leading-snug text-gray-500">
                {t("render.kadr.maslahat")}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={t("common.yopish")}
              className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Dialog.Close>
          </div>
          {still && (
            <>
              <img
                src={still.url}
                alt={t("render.kadr.sarlavha", { n: still.station })}
                className="max-h-[60vh] w-full rounded-2xl bg-gray-50 object-contain ring-1 ring-inset ring-gray-200"
              />
              <button
                type="button"
                onClick={() => void saveStill(still.blob, still.filename)}
                className="min-h-[48px] rounded-full bg-brand text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.99]"
              >
                {t("render.kadr.saqlash")}
              </button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
