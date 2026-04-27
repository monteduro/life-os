import { ReactRenderer } from '@tiptap/react'
import MentionList, { type MentionItem, type MentionListHandle } from '../components/editor/MentionList'
import { toVaultRelativePath } from '../core/vault/paths'
import { useVaultStore } from '../stores/vaultStore'
import type { VaultFolderNode } from '../core/vault/types'

function flattenFolders(rootPath: string, nodes: VaultFolderNode[]): MentionItem[] {
  return nodes.flatMap((node) => [
    {
      id: toVaultRelativePath(rootPath, node.path),
      label: node.name,
      type: 'folder' as const,
      icon: undefined,
    },
    ...flattenFolders(rootPath, node.children),
  ])
}

// ─── Suggestion Config ────────────────────────────────────────────────────────

export const mentionSuggestion = {
  char: '@',

  /**
   * Reads folders from the local vault store
   * and returns filtered items matching the current query.
   */
  items: ({ query }: { query: string }): MentionItem[] => {
    const currentVault = useVaultStore.getState().currentVault
    const folders = currentVault ? flattenFolders(currentVault.rootPath, currentVault.folders) : []

    const q = query.toLowerCase()

    return folders
      .filter(item => item.label.toLowerCase().includes(q))
      .slice(0, 8)
  },

  render: () => {
    let renderer: ReactRenderer<MentionListHandle> | null = null
    let popup: HTMLDivElement | null = null

    const positionPopup = (clientRect: (() => DOMRect | null) | null | undefined) => {
      if (!popup || !clientRect) return
      const rect = clientRect()
      if (!rect) return

      // Try to position below; if not enough space, position above
      const popupHeight = popup.offsetHeight || 220
      const spaceBelow = window.innerHeight - rect.bottom

      const top = spaceBelow >= popupHeight + 8
        ? rect.bottom + 4
        : rect.top - popupHeight - 4

      popup.style.top = `${Math.max(8, top)}px`
      popup.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`
    }

    return {
      onStart: (props: any) => {
        popup = document.createElement('div')
        Object.assign(popup.style, {
          position: 'fixed',
          zIndex: '9999',
        })
        document.body.appendChild(popup)

        renderer = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        })

        popup.appendChild(renderer.element)
        // Position after a tick so the popup has a rendered height
        requestAnimationFrame(() => positionPopup(props.clientRect))
      },

      onUpdate: (props: any) => {
        renderer?.updateProps(props)
        requestAnimationFrame(() => positionPopup(props.clientRect))
      },

      onKeyDown: (props: any) => {
        if (props.event.key === 'Escape') {
          renderer?.destroy()
          popup?.remove()
          renderer = null
          popup = null
          return true
        }
        return renderer?.ref?.onKeyDown(props) ?? false
      },

      onExit: () => {
        renderer?.destroy()
        popup?.remove()
        renderer = null
        popup = null
      },
    }
  },
}
