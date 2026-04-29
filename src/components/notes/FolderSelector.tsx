import { useState, useMemo } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Folder as FolderIcon, Search, Check, ChevronRight } from 'lucide-react'
import { mapVaultFoldersToAppFolders } from '../../core/vault/adapters'
import { getIcon } from '../../lib/iconMap'
import { useVaultStore } from '../../stores/vaultStore'
import type { Folder } from '../../types'

interface FolderSelectorProps {
    folderId: string | null
    onChange?: (newFolderId: string | null) => void
    readOnly?: boolean
}

export default function FolderSelector({ folderId, onChange, readOnly = false }: FolderSelectorProps) {
    const currentVault = useVaultStore((state) => state.currentVault)
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

    const toggleFolder = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setExpandedFolders((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const folders = useMemo(() => {
        if (!currentVault) return []
        return mapVaultFoldersToAppFolders(currentVault.folders)
    }, [currentVault])

    const activeFolder = useMemo(
        () => flattenFolders(folders).find((f) => f.id === folderId) ?? null,
        [folderId, folders],
    )
    const InboxIcon = getIcon(null, 'inbox')

    // Recursive search to find folders matching the search or having children that match
    const filterTree = (nodes: Folder[], query: string): Folder[] => {
        if (!query.trim()) return nodes
        const lowerQuery = query.toLowerCase()

        return nodes.reduce((acc: Folder[], node) => {
            const matchesSelf = node.name.toLowerCase().includes(lowerQuery)
            const filteredChildren = node.children ? filterTree(node.children, query) : []
            const hasMatchingChildren = filteredChildren.length > 0

            if (matchesSelf || hasMatchingChildren) {
                acc.push({
                    ...node,
                    children: filteredChildren,
                })
            }
            return acc
        }, [])
    }

    const folderTree = useMemo(() => {
        if (!folders.length) return []
        const activeFolders = folders.filter(f => !f.is_archived)
        const tree = activeFolders.filter((folder) => folder.parent_id === null)
        if (!search.trim()) return tree
        return filterTree(tree, search)
    }, [folders, search])

    const Trigger = (
        <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-stone-200 bg-stone-50 text-stone-600 text-xs font-medium transition-colors ${!readOnly && 'hover:bg-stone-100 hover:border-stone-300 cursor-pointer'
                }`}
            onClick={(e) => {
                if (!readOnly) {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!open) setOpen(true)
                }
            }}
        >
            {folderId === null ? (
                <InboxIcon className="w-3.5 h-3.5 text-stone-400" />
            ) : (
                <FolderIcon className="w-3.5 h-3.5 text-stone-400" />
            )}
            <span>{activeFolder?.name || 'Inbox'}</span>
        </div>
    )

    if (readOnly) {
        return Trigger
    }

    const renderFolderItem = (folder: Folder, depth: number = 0) => {
        const isSelected = folderId === folder.id
        const isExpanded = expandedFolders.has(folder.id) || !!search.trim()
        const hasChildren = folder.children && folder.children.length > 0
        const paddingLeft = depth * 16
        const Icon = getIcon(folder.icon, 'folder')

        return (
            <div key={folder.id} className="flex flex-col">
                <button
                    onClick={() => {
                        onChange?.(folder.id)
                        setOpen(false)
                    }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs w-full text-left transition-colors relative group ${isSelected ? 'bg-stone-50 font-medium text-stone-800' : 'text-stone-600 hover:bg-stone-50'
                        }`}
                    style={{ paddingLeft: `${paddingLeft + 8}px` }}
                >
                    <div className="w-3.5 flex items-center justify-center">
                        {hasChildren ? (
                            <div
                                onClick={(e) => toggleFolder(folder.id, e)}
                                className="p-0.5 hover:bg-stone-200/50 rounded transition-colors"
                            >
                                <ChevronRight className={`w-3 h-3 text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </div>
                        ) : (
                            <Icon className={`w-3 h-3 ${isSelected ? 'text-stone-700' : 'text-stone-300'}`} />
                        )}
                    </div>
                    <span className="flex-1 truncate">{folder.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-stone-700" />}
                </button>
                {hasChildren && isExpanded && (
                    <div className="flex flex-col">
                        {folder.children!.map(child => renderFolderItem(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
            <PopoverPrimitive.Trigger asChild>
                {Trigger}
            </PopoverPrimitive.Trigger>

            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    align="start"
                    sideOffset={4}
                    className="z-50 w-64 rounded-xl bg-white p-1 border border-stone-100 shadow-soft-lg outline-none origin-top-left flex flex-col max-h-64"
                    onOpenAutoFocus={(e) => {
                        e.preventDefault()
                    }}
                >
                    <div className="flex items-center gap-2 px-2 pb-1 pt-1 mb-1 border-b border-stone-50">
                        <Search className="w-3.5 h-3.5 text-stone-400" />
                        <input
                            autoFocus
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            className="flex-1 bg-transparent text-xs text-stone-700 outline-none placeholder:text-stone-300 py-1"
                            placeholder="Search folders..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="overflow-y-auto flex-1 p-1 scrollbar-hide">
                        {!currentVault ? (
                            <div className="py-2 px-2 text-xs text-stone-400 text-center">No vault open</div>
                        ) : (
                            <div className="flex flex-col">
                                {!search.trim() && (
                                    <button
                                        onClick={() => {
                                            onChange?.(null)
                                            setOpen(false)
                                        }}
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs w-full text-left transition-colors mb-0.5 ${folderId === null ? 'bg-stone-50 font-medium text-stone-800' : 'text-stone-600 hover:bg-stone-50'
                                            }`}
                                    >
                                        <div className="w-3.5 flex items-center justify-center">
                                            <InboxIcon className={`w-3 h-3 ${folderId === null ? 'text-stone-700' : 'text-stone-300'}`} />
                                        </div>
                                        <span className="flex-1 truncate">Inbox</span>
                                        {folderId === null && <Check className="w-3.5 h-3.5 text-stone-700" />}
                                    </button>
                                )}

                                {folderTree.length === 0 && search.trim() ? (
                                    <div className="py-2 px-2 text-xs text-stone-400 text-center">No results</div>
                                ) : (
                                    folderTree.map(folder => renderFolderItem(folder))
                                )}
                            </div>
                        )}
                    </div>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    )
}

function flattenFolders(folders: Folder[]): Folder[] {
    return folders.flatMap((folder) => [folder, ...flattenFolders(folder.children ?? [])])
}
