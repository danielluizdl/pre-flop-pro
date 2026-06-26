import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Acessibilidade de diálogo: foco inicial dentro do modal, Tab preso ao modal
// (focus trap), Esc fecha (quando onClose é fornecido) e restaura o foco ao
// elemento anterior ao desmontar. onClose ausente = modal obrigatório (sem Esc).
export function useModalA11y<T extends HTMLElement>(open: boolean, onClose?: () => void) {
  const ref = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const node = ref.current
    if (!node || !open) return
    const prevFocus = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))

    if (!node.contains(document.activeElement)) focusables()[0]?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || !node!.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !node!.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKey)
    return () => {
      node.removeEventListener('keydown', onKey)
      prevFocus?.focus?.()
    }
  }, [open])

  return ref
}
