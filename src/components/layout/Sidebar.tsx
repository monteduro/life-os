import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Folder as FolderIcon, FolderPlus } from 'lucide-react'
import { useNavigationStore } from '../../stores/navigationStore'
import { useVaultStore } from '../../stores/vaultStore'
import { mapVaultFoldersToAppFolders } from '../../core/vault/adapters'
import { getIcon } from '../../lib/iconMap'
import TextPromptDialog from '../Form/TextPromptDialog'
import SidebarNavItem from './SidebarNavItem'
import FolderTree from './FolderTree'
import type { Folder } from '../../types'

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { currentVault, createFolder, moveFolder } = useVaultStore()
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [activeDragFolderId, setActiveDragFolderId] = useState<string | null>(null)
  const [overFolderId, setOverFolderId] = useState<string | null>(null)
  const [pendingMoveFolderId, setPendingMoveFolderId] = useState<string | null>(null)

  const { selectedFolderId, sidebarOpen, selectFolder, selectInbox } = useNavigationStore()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const folderTree = currentVault ? mapVaultFoldersToAppFolders(currentVault.folders) : []
  const activeDragFolder = activeDragFolderId ? findFolderById(folderTree, activeDragFolderId) : null

  const inboxCount = currentVault
    ? currentVault.documents.filter((document) => document.parentPath === null).length
    : 0

  const handleCreateFolder = async (name: string) => {
    if (!currentVault) return

    const folderPath = await createFolder(selectedFolderId, name.trim())
    if (!folderPath) return

    const folderName = folderPath.split('/').pop() ?? name.trim()
    selectFolder(folderPath, folderName)
    setCreateFolderOpen(false)
  }

  const handleMoveFolder = async (folderId: string, targetParentId: string | null) => {
    setPendingMoveFolderId(folderId)
    const movedPath = await moveFolder(folderId, targetParentId)
    setActiveDragFolderId(null)
    setOverFolderId(null)
    setPendingMoveFolderId(null)

    if (!movedPath) return

    const folderName = movedPath.split('/').pop() ?? 'Folder'
    selectFolder(movedPath, folderName)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragFolderId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const draggedFolderId = String(event.active.id)
    const targetId = event.over ? String(event.over.id) : null

    if (targetId && draggedFolderId !== targetId) {
      setPendingMoveFolderId(draggedFolderId)
    }
    setActiveDragFolderId(null)
    setOverFolderId(null)

    if (!targetId || draggedFolderId === targetId) {
      setPendingMoveFolderId(null)
      return
    }

    void handleMoveFolder(draggedFolderId, targetId === ROOT_DROP_ID ? null : targetId)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="
          hidden lg:flex
          w-64 flex-col bg-white border-r border-stone-100
          h-screen sticky top-0 overflow-y-auto
        "
      >
        <SidebarContent
          folderTree={folderTree}
          inboxCount={inboxCount}
          selectedFolderId={selectedFolderId}
          selectInbox={selectInbox}
          onCreateFolder={() => setCreateFolderOpen(true)}
          sensors={sensors}
          activeDragFolderId={activeDragFolderId}
          pendingMoveFolderId={pendingMoveFolderId}
          activeDragFolderName={activeDragFolder?.name ?? null}
          overFolderId={overFolderId}
          onDragStart={handleDragStart}
          onDragOver={(event) => setOverFolderId(event.over ? String(event.over.id) : null)}
          onDragEnd={handleDragEnd}
        />
      </aside>

      {/* Mobile sidebar (overlay) */}
      <aside
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50
          w-64 flex flex-col bg-white border-r border-stone-100
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarContent
          folderTree={folderTree}
          inboxCount={inboxCount}
          selectedFolderId={selectedFolderId}
          selectInbox={selectInbox}
          onCreateFolder={() => setCreateFolderOpen(true)}
          sensors={sensors}
          activeDragFolderId={activeDragFolderId}
          pendingMoveFolderId={pendingMoveFolderId}
          activeDragFolderName={activeDragFolder?.name ?? null}
          overFolderId={overFolderId}
          onDragStart={handleDragStart}
          onDragOver={(event) => setOverFolderId(event.over ? String(event.over.id) : null)}
          onDragEnd={handleDragEnd}
        />
      </aside>

      <TextPromptDialog
        open={createFolderOpen}
        title="Create folder"
        description={selectedFolderId ? 'The new folder will be created inside the currently selected folder.' : 'The new folder will be created at the vault root.'}
        placeholder="Folder name"
        confirmLabel="Create"
        cancelLabel="Cancel"
        onCancel={() => setCreateFolderOpen(false)}
        onConfirm={handleCreateFolder}
      />
    </>
  )
}

// ─── Sidebar Content ──────────────────────────────────────────────────────────

interface SidebarContentProps {
  folderTree: Folder[]
  inboxCount: number
  selectedFolderId: string | null
  selectInbox: () => void
  onCreateFolder: () => void
  sensors: ReturnType<typeof useSensors>
  activeDragFolderId: string | null
  pendingMoveFolderId: string | null
  activeDragFolderName: string | null
  overFolderId: string | null
  onDragStart: (event: DragStartEvent) => void
  onDragOver: (event: { over: { id: string | number } | null }) => void
  onDragEnd: (event: DragEndEvent) => void
}

function SidebarContent({
  folderTree,
  inboxCount,
  selectedFolderId,
  selectInbox,
  onCreateFolder,
  sensors,
  activeDragFolderId,
  pendingMoveFolderId,
  activeDragFolderName,
  overFolderId,
  onDragStart,
  onDragOver,
  onDragEnd,
}: SidebarContentProps) {
  const collisionDetection: CollisionDetection = (args) => {
    const collisions = pointerWithin(args)
    const nonRootCollisions = collisions.filter((collision) => collision.id !== ROOT_DROP_ID)
    return nonRootCollisions.length > 0 ? nonRootCollisions : collisions
  }

  return (
    <>
      {/* Logo */}
      <div
        className="px-6 flex items-center justify-between border-b border-stone-100 shrink-0"
        style={{ height: 'var(--navbar-height)' }}
      >
        <span className="text-base font-semibold text-stone-800 tracking-tight">
          smart<span className="text-stone-400 font-normal">notes</span>
        </span>
        <button
          type="button"
          onClick={() => {
            void onCreateFolder()
          }}
          className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          aria-label="Create folder"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
      <RootDropZone>
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col">
        {/* Inbox */}
        <div className="mb-1">
          <SidebarNavItem
            Icon={getIcon(null, 'inbox')}
            label="Root"
            count={inboxCount}
            isActive={selectedFolderId === null}
            onClick={selectInbox}
            className={overFolderId === ROOT_DROP_ID ? 'ring-1 ring-stone-300 bg-stone-100/80' : undefined}
          />
        </div>

        {/* Folder Tree */}
        <FolderTree
          folders={folderTree}
          activeDragFolderId={activeDragFolderId}
          pendingMoveFolderId={pendingMoveFolderId}
          overFolderId={overFolderId}
        />
      </nav>
      </RootDropZone>
      <DragOverlay>
        {activeDragFolderName ? <FolderDragPreview name={activeDragFolderName} /> : null}
      </DragOverlay>
      </DndContext>
    </>
  )
}

const ROOT_DROP_ID = '__root__'

function RootDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: ROOT_DROP_ID })

  return (
    <div ref={setNodeRef} className="flex-1 min-h-0">
      {children}
    </div>
  )
}

function FolderDragPreview({ name }: { name: string }) {
  return (
    <div className="pointer-events-none flex items-center gap-2 rounded-lg border border-stone-200 bg-white/95 px-3 py-1.5 text-[13px] font-medium text-stone-800 shadow-xl">
      <FolderIcon className="h-4 w-4 text-stone-500" />
      <span className="max-w-40 truncate">{name}</span>
    </div>
  )
}

function findFolderById(folders: Folder[], id: string): Folder | null {
  for (const folder of folders) {
    if (folder.id === id) {
      return folder
    }

    const nested = findFolderById(folder.children ?? [], id)
    if (nested) {
      return nested
    }
  }

  return null
}
