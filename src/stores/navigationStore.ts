import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// ─── Navigation State Interface ──────────────────────────────────────────────

interface NavigationState {
  // Folder corrente (null = inbox)
  selectedFolderId: string | null
  selectedFolderName: string | null    // per display nel header

  // Folder espanse nell'albero (per renderizzare children)
  expandedFolders: Set<string>

  // Sidebar (mobile)
  sidebarOpen: boolean

  // Actions
  selectFolder: (folderId: string | null, name?: string | null) => void
  selectInbox: () => void
  toggleFolder: (folderId: string) => void
  expandFolder: (folderId: string) => void
  collapseFolder: (folderId: string) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNavigationStore = create<NavigationState>()(
  devtools(
    (set) => ({
      // Initial state
      selectedFolderId: null,
      selectedFolderName: null,
      expandedFolders: new Set<string>(),
      sidebarOpen: false,

      // Actions
      selectFolder: (folderId, name = null) =>
        set(
          { selectedFolderId: folderId, selectedFolderName: name },
          false,
          'selectFolder'
        ),

      selectInbox: () =>
        set(
          { selectedFolderId: null, selectedFolderName: null },
          false,
          'selectInbox'
        ),

      toggleFolder: (folderId) =>
        set(
          (state) => {
            const newExpanded = new Set(state.expandedFolders)
            if (newExpanded.has(folderId)) {
              newExpanded.delete(folderId)
            } else {
              newExpanded.add(folderId)
            }
            return { expandedFolders: newExpanded }
          },
          false,
          'toggleFolder'
        ),

      expandFolder: (folderId) =>
        set(
          (state) => {
            const newExpanded = new Set(state.expandedFolders)
            newExpanded.add(folderId)
            return { expandedFolders: newExpanded }
          },
          false,
          'expandFolder'
        ),

      collapseFolder: (folderId) =>
        set(
          (state) => {
            const newExpanded = new Set(state.expandedFolders)
            newExpanded.delete(folderId)
            return { expandedFolders: newExpanded }
          },
          false,
          'collapseFolder'
        ),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'toggleSidebar'),

      setSidebarOpen: (open) =>
        set({ sidebarOpen: open }, false, 'setSidebarOpen'),
    }),
    { name: 'NavigationStore' }
  )
)
