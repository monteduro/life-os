import { createContext, useContext } from "react"

// ─── Editor Context for custom callbacks ────────────────────────────────────────

interface EditorCallbacksContextValue {
  onBeforeNavigate?: () => Promise<void> | void
}

export const EditorCallbacksContext = createContext<EditorCallbacksContextValue>({})

export const useEditorCallbacks = () => useContext(EditorCallbacksContext)
