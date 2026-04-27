import { useCurrentEditor, useEditorState } from "@tiptap/react"
import { Button } from "@/components/tiptap-ui-primitive/button"

export function TableButton() {
  const { editor } = useCurrentEditor()

  const canInsert = useEditorState({
    editor,
    selector: (ctx) => ctx.editor?.can().insertTable() ?? false,
  })

  if (!editor || !editor.isEditable) return null
  if (!editor.schema.nodes.table) return null

  return (
    <Button
      type="button"
      data-style="ghost"
      data-active-state="off"
      role="button"
      disabled={!canInsert}
      data-disabled={!canInsert}
      tabIndex={-1}
      aria-label="Inserisci tabella"
      tooltip="Table"
      onMouseDown={(e) => {
        e.preventDefault()
        editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        className="tiptap-button-icon"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M.99 5.24A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25l.01 9.5A2.25 2.25 0 0 1 16.76 17H3.26A2.267 2.267 0 0 1 1 14.74l-.01-9.5Zm8.26 9.52v-.625a.75.75 0 0 0-.75-.75H3.25a.75.75 0 0 0-.75.75v.615c0 .414.336.75.75.75h5.373a.75.75 0 0 0 .627-.74Zm1.5 0a.75.75 0 0 0 .627.74h5.373a.75.75 0 0 0 .75-.75v-.615a.75.75 0 0 0-.75-.75H11.5a.75.75 0 0 0-.75.75v.625Zm6.75-3.63v-.625a.75.75 0 0 0-.75-.75H11.5a.75.75 0 0 0-.75.75v.625c0 .414.336.75.75.75h5.25a.75.75 0 0 0 .75-.75Zm-8.25 0v-.625a.75.75 0 0 0-.75-.75H3.25a.75.75 0 0 0-.75.75v.625c0 .414.336.75.75.75H8.5a.75.75 0 0 0 .75-.75ZM17.5 7.5v-.625a.75.75 0 0 0-.75-.75H11.5a.75.75 0 0 0-.75.75V7.5c0 .414.336.75.75.75h5.25a.75.75 0 0 0 .75-.75Zm-8.25 0v-.625a.75.75 0 0 0-.75-.75H3.25a.75.75 0 0 0-.75.75V7.5c0 .414.336.75.75.75H8.5a.75.75 0 0 0 .75-.75Z"
        />
      </svg>
    </Button>
  )
}
