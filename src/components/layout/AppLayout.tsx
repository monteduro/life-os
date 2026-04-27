import { useNavigationStore } from '../../stores/navigationStore'
import { useVaultStore } from '../../stores/vaultStore'
import Sidebar from './Sidebar'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: React.ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: AppLayoutProps) {
  const { sidebarOpen, setSidebarOpen, selectedFolderName } = useNavigationStore()
  const { currentVault, openVault, rescanVault, status } = useVaultStore()
  const currentTitle = selectedFolderName ?? currentVault?.rootName ?? 'Vault'

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-stone-900/20 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-stone-100 px-6 flex items-center justify-between"
          style={{ height: 'var(--navbar-height)' }}
        >
          {/* Mobile: hamburger */}
          <button
            className="lg:hidden text-stone-600 hover:text-stone-900 p-2 -ml-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* Active view title */}
          <div className="lg:ml-0 ml-2 min-w-0">
            <span className="block text-lg font-semibold text-stone-800 tracking-tight truncate">
              {currentTitle}
            </span>
            {currentVault && (
              <span className="hidden sm:block text-xs text-stone-400 truncate">
                {currentVault.rootName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void rescanVault()}
              disabled={status === 'loading'}
              className="text-xs text-stone-500 hover:text-stone-800 disabled:opacity-50 transition-colors"
            >
              {status === 'loading' ? 'Re-scan…' : 'Re-scan'}
            </button>
            <button
              onClick={() => void openVault()}
              className="text-xs text-stone-400 hover:text-stone-800 transition-colors"
            >
              Apri altra cartella
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-10">{children}</main>
      </div>
    </div>
  )
}
