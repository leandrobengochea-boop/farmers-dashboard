'use client'

interface NavbarProps {
  onRefresh: () => void
  refreshing: boolean
}

export default function Navbar({ onRefresh, refreshing }: NavbarProps) {
  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">

        {/* Logo PSA. */}
        <div className="flex items-center gap-4">
          <span
            style={{
              fontWeight: 900,
              fontSize: '1.6rem',
              letterSpacing: '-0.02em',
              color: '#FF5200',
              fontFamily: "'Arial Black', 'Arial Bold', Arial, sans-serif",
              lineHeight: 1,
            }}
          >
            PSA.
          </span>
          <div className="w-px h-6 bg-slate-600" />
          <span className="text-slate-300 font-medium text-sm tracking-wide">
            Farmers Dashboard
          </span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>
    </nav>
  )
}
