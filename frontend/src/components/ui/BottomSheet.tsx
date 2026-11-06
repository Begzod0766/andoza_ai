import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type SnapPoint = 'half' | 'full'

interface BottomSheetProps {
  open: boolean
  onOpenChange(open: boolean): void
  /** Default snap point when sheet first opens. */
  defaultSnap?: SnapPoint
  /** Screen title for accessibility. */
  title: string
  children: React.ReactNode
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SNAP: Record<SnapPoint, string> = {
  half: '50vh',
  full: '90vh',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomSheet({
  open,
  onOpenChange,
  defaultSnap = 'half',
  title,
  children,
}: BottomSheetProps) {
  const [snap, setSnap] = React.useState<SnapPoint>(defaultSnap)
  const dragControls = useDragControls()
  const sheetRef = React.useRef<HTMLDivElement | null>(null)

  // Reset snap to default each time the sheet opens
  React.useEffect(() => {
    if (open) setSnap(defaultSnap)
  }, [open, defaultSnap])

  function handleDragEnd(
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { y: number }; velocity: { y: number } },
  ) {
    const { offset, velocity } = info

    // Fast downward flick → close
    if (velocity.y > 400) {
      onOpenChange(false)
      return
    }

    // Slow upward drag from half → expand to full
    if (snap === 'half' && offset.y < -60) {
      setSnap('full')
      return
    }

    // Slow downward drag from full → collapse to half
    if (snap === 'full' && offset.y > 60) {
      setSnap('half')
      return
    }

    // Slow downward drag from half → close
    if (snap === 'half' && offset.y > 80) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                key="overlay"
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>

            {/* Sheet */}
            <Dialog.Content
              asChild
              // Radix would focus the first tabbable element on open: in the AI designer that is the
              // "Room type" <select>. iOS WKWebView opens a picker or keyboard only when focus ARRIVES
              // by the user's gesture, so a tap on a field that already holds focus opened nothing
              // (#184: the select ignored taps but opened when reached with the keyboard's arrow).
              // Focus the sheet itself instead; the focus trap and Escape still work from there.
              onOpenAutoFocus={(e) => {
                e.preventDefault()
                const sheet = sheetRef.current
                if (sheet && !sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true })
              }}
            >
              <motion.div
                ref={sheetRef}
                key="sheet"
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0.05, bottom: 0.3 }}
                onDragEnd={handleDragEnd}
                animate={{ height: SNAP[snap], y: 0 }}
                initial={{ y: '100%' }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className={cn(
                  'fixed bottom-0 left-0 right-0 z-50',
                  'bg-white',
                  'rounded-t-3xl shadow-card',
                  'flex flex-col overflow-hidden',
                  'outline-none',
                )}
                // No `touch-action: none` here: it would sit over every native control in the
                // sheet, and iOS WebKit then does not open a <select>'s picker (#184). The drag only
                // ever starts from the grab handle (dragListener={false}), so only it needs one.
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                {/* Grab handle */}
                <div
                  className="flex-shrink-0 flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => dragControls.start(e)}
                  data-sheet-handle=""
                  style={{ touchAction: 'none' }}
                  aria-hidden="true"
                >
                  <div className="w-12 h-1.5 rounded-full bg-neutral-300 transition-colors" />
                </div>

                {/* Hidden title for screen readers */}
                <Dialog.Title className="sr-only">{title}</Dialog.Title>

                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-2">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
