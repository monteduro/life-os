import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFocus,
  useFloating,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { cloneElement, isValidElement, useMemo, useState, type ReactElement } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  side?: 'top' | 'bottom'
}

export default function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false)

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: side,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
    ],
  })

  const hover = useHover(context, { move: false, delay: { open: 80, close: 0 } })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role])

  const reference = useMemo(() => {
    if (!isValidElement(children)) {
      return (
        <span ref={refs.setReference} {...getReferenceProps()}>
          {children}
        </span>
      )
    }

    return cloneElement(children as ReactElement<Record<string, unknown>>, {
      ref: refs.setReference,
      ...getReferenceProps((children.props as Record<string, unknown>) ?? {}),
    })
  }, [children, getReferenceProps, refs])

  return (
    <>
      {reference}
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[120] whitespace-nowrap rounded-md bg-stone-900/95 px-2 py-1 text-[10px] font-medium text-white shadow-md"
            {...getFloatingProps()}
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
