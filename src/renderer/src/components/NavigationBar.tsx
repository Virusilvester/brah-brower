import { useState, useEffect } from 'react'
import '../styles/NavigationBar.css'

interface NavigationBarProps {
  url: string
  canGoBack?: boolean
  canGoForward?: boolean
  isLoading?: boolean
  isBookmarked: boolean
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onNavigate: (url: string) => void
  onToggleBookmark: () => void // Changed from onAddBookmark
  onShowHistory: () => void
  onShowBookmarks: () => void
  onShowDownloads: () => void
  onShowSettings: () => void
}

export function NavigationBar({
  url,
  canGoBack,
  canGoForward,
  isLoading,
  isBookmarked,
  onBack,
  onForward,
  onReload,
  onNavigate,
  onToggleBookmark, // Use toggle
  onShowHistory,
  onShowBookmarks,
  onShowDownloads,
  onShowSettings
}: NavigationBarProps) {
  const [inputValue, setInputValue] = useState(url)

  useEffect(() => {
    setInputValue(url)
  }, [url])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNavigate(inputValue)
  }

  return (
    <div className="navigation-bar">
      <div className="nav-buttons">
        <button className="nav-btn" onClick={onBack} disabled={!canGoBack} title="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button className="nav-btn" onClick={onForward} disabled={!canGoForward} title="Forward">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button className="nav-btn reload" onClick={onReload} title={isLoading ? 'Stop' : 'Reload'}>
          {isLoading ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          )}
        </button>
      </div>

      <form className="address-bar" onSubmit={handleSubmit}>
        <div className="security-icon">{url.startsWith('https') ? '🔒' : '⚠️'}</div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search or enter address"
        />
      </form>

      <div className="action-buttons">
        {/* Star button now toggles */}
        <button
          className={`action-btn bookmark-btn ${isBookmarked ? 'active' : ''}`}
          onClick={onToggleBookmark}
          title={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
        >
          <svg
            viewBox="0 0 24 24"
            fill={isBookmarked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>

        <button className="action-btn" onClick={onShowHistory} title="History">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>

        <button className="action-btn" onClick={onShowBookmarks} title="Bookmarks">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        <button className="action-btn" onClick={onShowDownloads} title="Downloads">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        <button className="action-btn" onClick={onShowSettings} title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
