import { useMemo, useRef, useState, useEffect, JSX } from 'react'
import '../styles/NavigationBar.css'

interface NavigationBarProps {
  url: string
  canGoBack?: boolean
  canGoForward?: boolean
  isLoading?: boolean
  isBookmarked: boolean
  isDownloading?: boolean
  downloadProgress?: number | null
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
  isDownloading,
  downloadProgress,
  onBack,
  onForward,
  onReload,
  onNavigate,
  onToggleBookmark, // Use toggle
  onShowHistory,
  onShowBookmarks,
  onShowDownloads,
  onShowSettings
}: NavigationBarProps): JSX.Element {
  const [draftValue, setDraftValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const debounceTimerRef = useRef<number | null>(null)
  const fetchIdRef = useRef(0)
  const cacheRef = useRef<Map<string, string[]>>(new Map())

  const inputValue = isEditing ? draftValue : url

  const shouldSuggest = useMemo(() => {
    if (!isEditing) return false
    const trimmed = draftValue.trim()
    if (trimmed.length < 2) return false
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false
    if (trimmed.startsWith('brah://')) return false
    if (trimmed.startsWith('file://')) return false
    if (trimmed.startsWith('chrome://')) return false
    return true
  }, [draftValue, isEditing])

  useEffect(() => {
    if (!showSuggestions) return
    if (!shouldSuggest) return

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current)
    }

    const query = draftValue.trim()
    debounceTimerRef.current = window.setTimeout(async () => {
      const cached = cacheRef.current.get(query)
      if (cached) {
        setSuggestions(cached)
        setHighlightedIndex(-1)
        return
      }

      const fetchId = ++fetchIdRef.current
      try {
        const res = await fetch(
          `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(
            query
          )}`
        )
        const data = (await res.json()) as unknown
        if (fetchId !== fetchIdRef.current) return
        const list =
          Array.isArray(data) && Array.isArray((data as any)[1])
            ? ((data as any)[1] as unknown[]).filter((v) => typeof v === 'string').slice(0, 8)
            : []
        cacheRef.current.set(query, list as string[])
        setSuggestions(list as string[])
        setHighlightedIndex(-1)
      } catch {
        if (fetchId !== fetchIdRef.current) return
        setSuggestions([])
        setHighlightedIndex(-1)
      }
    }, 140)

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [draftValue, shouldSuggest, showSuggestions])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    setShowSuggestions(false)
    setIsEditing(false)
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
        <div className="address-input-wrap">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onFocus={() => {
              setIsEditing(true)
              setDraftValue(url)
              setShowSuggestions(true)
            }}
            onBlur={() => {
              window.setTimeout(() => setShowSuggestions(false), 120)
              window.setTimeout(() => setIsEditing(false), 160)
            }}
            onKeyDown={(e) => {
              if (!showSuggestions || suggestions.length === 0) return
              if (e.key === 'Escape') {
                setShowSuggestions(false)
                setHighlightedIndex(-1)
                return
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlightedIndex((idx) => Math.min(suggestions.length - 1, idx + 1))
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlightedIndex((idx) => Math.max(-1, idx - 1))
                return
              }
              if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault()
                const value = suggestions[highlightedIndex]
                setDraftValue(value)
                setShowSuggestions(false)
                setIsEditing(false)
                onNavigate(value)
              }
            }}
            placeholder="Search or enter address"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && suggestions.length > 0}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="address-suggestions" role="listbox">
              {suggestions.map((s, idx) => (
                <button
                  key={`${s}-${idx}`}
                  type="button"
                  className={`address-suggestion ${idx === highlightedIndex ? 'active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setDraftValue(s)
                    setShowSuggestions(false)
                    setIsEditing(false)
                    onNavigate(s)
                  }}
                  role="option"
                  aria-selected={idx === highlightedIndex}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
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

        <button
          className={`action-btn downloads-btn ${isDownloading ? 'downloading' : ''} ${
            isDownloading && downloadProgress == null ? 'indeterminate' : ''
          }`}
          onClick={onShowDownloads}
          title="Downloads"
          style={
            isDownloading && typeof downloadProgress === 'number'
              ? ({ ['--download-progress' as any]: downloadProgress } as React.CSSProperties)
              : undefined
          }
        >
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
