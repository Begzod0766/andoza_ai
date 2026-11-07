import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidePanelProps {
  open: boolean
  onOpenChange(open: boolean): void
  /** Shown at the top, and the dialog's accessible name. */
  title: string
  closeLabel: string
  children: React.ReactNode
}

/**
 * A panel at the right edge for wide screens: the BottomSheet's counterpart when there is room
 * beside the 3-D view. It dims nothing and stays open while the user works the room behind it (a
 * style applied from it shows in the room at once); its close button or Escape closes it.
 */
export function SidePanel({ open, onOpenChange, title, closeLabel, children }: SidePanelProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Content
              asChild
              data-variant="side"
              aria-describedby={undefined}
              // The room behind stays usable: a click or drag on it does not close the panel.
              onInteractOutside={(e) => e.preventDefault()}
              // As the BottomSheet: focus the panel, not its first field (iOS opens no picker for a
              // <select> that already holds focus, #184).
              onOpenAutoFocus={(e) => {
                e.preventDefault()
                panelRef.current?.focus({ preventScroll: true })
              }}
            >
              <motion.div
                ref={panelRef}
                key="side-panel"
                tabIndex={-1}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                className={cn(
                  'fixed bottom-0 right-0 top-0 z-50 flex w-[420px] max-w-full flex-col',
                  'border-l border-gray-200 bg-white shadow-card outline-none',
                )}
              >
                <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
                  <Dialog.Title className="text-base font-semibold text-gray-900">{title}</Dialog.Title>
                  <Dialog.Close
                    aria-label={closeLabel}
                    className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain py-3">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
