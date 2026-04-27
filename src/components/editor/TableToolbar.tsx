import { useCurrentEditor, useEditorState } from "@tiptap/react"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { ToolbarSeparator } from "@/components/tiptap-ui-primitive/toolbar"

import addColumnLeftSvg from "@material-symbols/svg-400/outlined/add_column_left.svg?raw"
import addColumnRightSvg from "@material-symbols/svg-400/outlined/add_column_right.svg?raw"
import addRowAboveSvg from "@material-symbols/svg-400/outlined/add_row_above.svg?raw"
import addRowBelowSvg from "@material-symbols/svg-400/outlined/add_row_below.svg?raw"
import deleteForeverSvg from "@material-symbols/svg-400/outlined/delete_forever.svg?raw"
import viewColumnSvg from "@material-symbols/svg-400/outlined/delete.svg?raw"
import tableRowsSvg from "@material-symbols/svg-400/outlined/delete_sweep.svg?raw"

function MatIcon({ svg }: { svg: string }) {
  return (
    <span
      className="tiptap-button-icon"
      style={{ width: 18, height: 18, display: "flex", alignItems: "center" }}
      // Il fill è controllato tramite currentColor — gli SVG di Material Symbols usano già fill="currentColor" implicitamente
      dangerouslySetInnerHTML={{
        __html: svg.replace(/<svg /, '<svg fill="currentColor" width="18" height="18" '),
      }}
    />
  )
}

function TableActionButton({
  onClick,
  label,
  disabled,
  svg,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  svg: string
}) {
  return (
    <Button
      type="button"
      data-style="ghost"
      data-active-state="off"
      role="button"
      disabled={disabled}
      data-disabled={disabled}
      tabIndex={-1}
      aria-label={label}
      tooltip={label}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      <MatIcon svg={svg} />
    </Button>
  )
}

export function TableToolbar() {
  const { editor } = useCurrentEditor()

  const isInTable = useEditorState({
    editor,
    selector: (ctx) => ctx.editor?.isActive("table") ?? false,
  })

  if (!editor || !isInTable) return null

  const can = editor.can()

  return (
    <>
      <ToolbarSeparator />

      <TableActionButton
        label="Aggiungi colonna a sinistra"
        svg={addColumnLeftSvg}
        disabled={!can.addColumnBefore()}
        onClick={() => editor.chain().focus().addColumnBefore().run()}
      />

      <TableActionButton
        label="Aggiungi colonna a destra"
        svg={addColumnRightSvg}
        disabled={!can.addColumnAfter()}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      />

      <TableActionButton
        label="Aggiungi riga sopra"
        svg={addRowAboveSvg}
        disabled={!can.addRowBefore()}
        onClick={() => editor.chain().focus().addRowBefore().run()}
      />

      <TableActionButton
        label="Aggiungi riga sotto"
        svg={addRowBelowSvg}
        disabled={!can.addRowAfter()}
        onClick={() => editor.chain().focus().addRowAfter().run()}
      />

      <TableActionButton
        label="Elimina colonna"
        svg={viewColumnSvg}
        disabled={!can.deleteColumn()}
        onClick={() => editor.chain().focus().deleteColumn().run()}
      />

      <TableActionButton
        label="Elimina riga"
        svg={tableRowsSvg}
        disabled={!can.deleteRow()}
        onClick={() => editor.chain().focus().deleteRow().run()}
      />

      <TableActionButton
        label="Elimina tabella"
        svg={deleteForeverSvg}
        disabled={!can.deleteTable()}
        onClick={() => editor.chain().focus().deleteTable().run()}
      />
    </>
  )
}
