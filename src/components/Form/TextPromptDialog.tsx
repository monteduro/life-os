import { useEffect, useState } from 'react'

interface TextPromptDialogProps {
  open: boolean
  title: string
  description?: string
  initialValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  onCancel: () => void
  onConfirm: (value: string) => void | Promise<void>
}

export default function TextPromptDialog({
  open,
  title,
  description,
  initialValue = '',
  placeholder,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
}: TextPromptDialogProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
    }
  }, [initialValue, open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/20 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          {description && <p className="text-sm text-stone-500">{description}</p>}
        </div>

        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const normalizedValue = value.trim()
            if (!normalizedValue) {
              return
            }
            void onConfirm(normalizedValue)
          }}
        >
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition-colors focus:border-stone-300"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
