"use client"

import { useCallback, useEffect, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { type Editor } from "@tiptap/react"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"

// --- Lib ---
import { isExtensionAvailable } from "@/lib/tiptap-utils"

// --- Icons ---
import { FilePlusIcon } from "@/components/tiptap-icons/file-plus-icon"

export const FILE_UPLOAD_SHORTCUT_KEY = "mod+shift+f"

/**
 * Configuration for the file upload functionality
 */
export interface UseFileUploadConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * Whether the button should hide when insertion is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Callback function called after a successful file insertion.
   */
  onInserted?: () => void
}

/**
 * Checks if file can be inserted in the current editor state
 */
export function canInsertFile(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  if (!isExtensionAvailable(editor, "fileUpload")) return false

  return editor.can().insertContent({ type: "fileUpload" })
}

/**
 * Checks if file upload is currently active
 */
export function isFileUploadActive(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  return editor.isActive("fileUpload")
}

/**
 * Inserts a file upload node in the editor
 */
export function insertFile(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  if (!canInsertFile(editor)) return false

  try {
    return editor
      .chain()
      .focus()
      .insertContent({
        type: "fileUpload",
      })
      .run()
  } catch {
    return false
  }
}

/**
 * Determines if the file button should be shown
 */
export function shouldShowButton(props: {
  editor: Editor | null
  hideWhenUnavailable: boolean
}): boolean {
  const { editor, hideWhenUnavailable } = props

  if (!editor || !editor.isEditable) return false

  if (!hideWhenUnavailable) {
    return true
  }

  if (!isExtensionAvailable(editor, "fileUpload")) return false

  if (!editor.isActive("code")) {
    return canInsertFile(editor)
  }

  return true
}

/**
 * Custom hook that provides file upload functionality for Tiptap editor
 */
export function useFileUpload(config?: UseFileUploadConfig) {
  const {
    editor: providedEditor,
    hideWhenUnavailable = false,
    onInserted,
  } = config || {}

  const { editor } = useTiptapEditor(providedEditor)
  const isMobile = useIsBreakpoint()
  const [isVisible, setIsVisible] = useState<boolean>(true)
  const canInsert = canInsertFile(editor)
  const isActive = isFileUploadActive(editor)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      setIsVisible(shouldShowButton({ editor, hideWhenUnavailable }))
    }

    handleSelectionUpdate()

    editor.on("selectionUpdate", handleSelectionUpdate)

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
    }
  }, [editor, hideWhenUnavailable])

  const handleFile = useCallback(() => {
    if (!editor) return false

    const success = insertFile(editor)
    if (success) {
      onInserted?.()
    }
    return success
  }, [editor, onInserted])

  useHotkeys(
    FILE_UPLOAD_SHORTCUT_KEY,
    (event) => {
      event.preventDefault()
      handleFile()
    },
    {
      enabled: isVisible && canInsert,
      enableOnContentEditable: !isMobile,
      enableOnFormTags: true,
    }
  )

  return {
    isVisible,
    isActive,
    handleFile,
    canInsert,
    label: "Add file",
    shortcutKeys: FILE_UPLOAD_SHORTCUT_KEY,
    Icon: FilePlusIcon,
  }
}
