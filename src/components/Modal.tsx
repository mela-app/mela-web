import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from './Icons'

interface ModalProps {
  labelledBy: string
  onClose(): void
  /** A sheet rises from the bottom (phones); centered is a dialog (computers); a drawer sits at the right edge. */
  variant?: 'sheet' | 'center' | 'drawer'
  children: ReactNode
}

/** A dialog over the live: Escape or a tap outside closes it; focus goes back where it was. */
export function Modal({ labelledBy, onClose, variant = 'center', children }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const first = dialog.current?.querySelector<HTMLElement>('[data-autofocus], input, a[href], button:not(.modal-close)')
    first?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  return (
    <div
      className={`modal-backdrop modal-backdrop-${variant}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={dialog} className={`modal modal-${variant}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <CloseIcon width={20} height={20} />
        </button>
      </div>
    </div>
  )
}
