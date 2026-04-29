import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// ─── Navigation State Interface ──────────────────────────────────────────────

interface NavigationState {
  selectedView: 'inbox' | 'folder' | 'upcoming'
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
  selectUpcoming: () => void
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
      selectedView: 'inbox',
      selectedFolderId: null,
      selectedFolderName: null,
      expandedFolders: new Set<string>(),
      sidebarOpen: false,

      // Actions
      selectFolder: (folderId, name = null) =>
        set(
          { selectedView: folderId === null ? 'inbox' : 'folder', selectedFolderId: folderId, selectedFolderName: name },
          false,
          'selectFolder'
        ),

      selectInbox: () =>
        set(
          { selectedView: 'inbox', selectedFolderId: null, selectedFolderName: null },
          false,
          'selectInbox'
        ),

      selectUpcoming: () =>
        set(
          { selectedView: 'upcoming', selectedFolderId: null, selectedFolderName: 'Upcoming' },
          false,
          'selectUpcoming'
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
