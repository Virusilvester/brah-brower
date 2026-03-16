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
  zoomLevel?: number
  adBlockEnabled?: boolean
  adBlockCount?: number
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onNavigate: (url: string) => void
  onToggleBookmark: () => void
  onShowHistory: () => void
  onShowBookmarks: () => void
  onShowDownloads: () => void
  onShowSettings: () => void
  onShowSiteSettings: () => void
  onToggleAdBlock?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void
  onToggleFindInPage?: () => void
}

export function NavigationBar({
  url,
  canGoBack,
  canGoForward,
  isLoading,
  isBookmarked,
  isDownloading,
  downloadProgress,
  zoomLevel = 100,
  adBlockEnabled = false,
  adBlockCount = 0,
  onBack,
  onForward,
  onReload,
  onNavigate,
  onToggleBookmark,
  onShowHistory,
  onShowBookmarks,
  onShowDownloads,
  onShowSettings,
  onShowSiteSettings,
  onToggleAdBlock,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onToggleFindInPage
}: NavigationBarProps): JSX.Element {
  const [draftValue, setDraftValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const debounceTimerRef = useRef<number | null>(null)
  const fetchIdRef = useRef(0)
  const cacheRef = useRef<Map<string, string[]>>(new Map())
  const inputRef = useRef<HTMLInputElement>(null)

  const inputValue = isEditing ? draftValue : url
  const isSecure = url.startsWith('https')
  const isInternal = url.startsWith('brah://')
  const isInternalOrBlank = isInternal || !url || url === 'about:blank'

  const shouldSuggest = useMemo(() => {
    if (!isEditing) return false
    const t = draftValue.trim()
    if (t.length < 2) return false
    if (
      t.startsWith('http://') ||
      t.startsWith('https://') ||
      t.startsWith('brah://') ||
      t.startsWith('file://')
    )
      return false
    return true
  }, [draftValue, isEditing])

  useEffect(() => {
    if (!showSuggestions || !shouldSuggest) return
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current)
    const query = draftValue.trim()
    debounceTimerRef.current = window.setTimeout(async () => {
      const cached = cacheRef.current.get(query)
      if (cached) {
        setSuggestions(cached)
        setHighlightedIndex(-1)
        return
      }
      const id = ++fetchIdRef.current
      try {
        const res = await fetch(
          `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`
        )
        const data = (await res.json()) as unknown
        if (id !== fetchIdRef.current) return
        const list =
          Array.isArray(data) && Array.isArray((data as any)[1])
            ? (((data as any)[1] as unknown[])
                .filter((v) => typeof v === 'string')
                .slice(0, 8) as string[])
            : []
        cacheRef.current.set(query, list)
        setSuggestions(list)
        setHighlightedIndex(-1)
      } catch {
        if (id !== fetchIdRef.current) return
        setSuggestions([])
      }
    }, 140)
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current)
    }
  }, [draftValue, shouldSuggest, showSuggestions])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault()
        inputRef.current?.select()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    setShowSuggestions(false)
    setIsEditing(false)
    onNavigate(inputValue)
  }

  const securityIcon = isInternal ? (
    <span style={{ fontSize: 11 }}>🏠</span>
  ) : isSecure ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ width: 11, height: 11, color: 'var(--success)' }}
    >
      <rect x="5" y="11" width="14" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ width: 11, height: 11, color: 'var(--warning)', opacity: 0.7 }}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )

  return (
    <div className="navigation-bar">
      <div className="nav-buttons">
        <button className="nav-btn" onClick={onBack} disabled={!canGoBack} title="Back (Alt+Left)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button
          className="nav-btn"
          onClick={onForward}
          disabled={!canGoForward}
          title="Forward (Alt+Right)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <button
          className="nav-btn reload"
          onClick={onReload}
          title={isLoading ? 'Stop' : 'Reload (Ctrl+R)'}
        >
          {isLoading ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="6" width="12" height="12" rx="1" />
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
        <div className="security-icon">{securityIcon}</div>
        <div className="address-input-wrap">
          <input
            ref={inputRef}
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
              if (!showSuggestions || !suggestions.length) return
              if (e.key === 'Escape') {
                setShowSuggestions(false)
                setHighlightedIndex(-1)
                return
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlightedIndex((i) => Math.min(suggestions.length - 1, i + 1))
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlightedIndex((i) => Math.max(-1, i - 1))
                return
              }
              if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault()
                const v = suggestions[highlightedIndex]
                setDraftValue(v)
                setShowSuggestions(false)
                setIsEditing(false)
                onNavigate(v)
              }
            }}
            placeholder="Search or enter address"
            spellCheck={false}
            autoComplete="off"
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
        {zoomLevel !== 100 && (
          <div className="zoom-badge" title="Click to reset zoom" onClick={onZoomReset}>
            {zoomLevel}%
          </div>
        )}

        {/* Ad block shield - only on real pages */}
        {onToggleAdBlock && !isInternalOrBlank && (
          <button
            className={`action-btn shield-btn ${adBlockEnabled ? 'shield-on' : 'shield-off'}`}
            onClick={onToggleAdBlock}
            title={
              adBlockEnabled
                ? `Ad Blocker ON · ${adBlockCount} blocked`
                : 'Ad Blocker OFF — click to enable'
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill={adBlockEnabled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {adBlockEnabled && adBlockCount > 0 && (
              <span className="shield-count">{adBlockCount > 999 ? '999+' : adBlockCount}</span>
            )}
          </button>
        )}

        {/* Site settings - only on real pages */}
        {!isInternalOrBlank && (
          <button
            className="action-btn site-settings-btn"
            onClick={onShowSiteSettings}
            title="Site Settings & Permissions"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
        )}

        {onZoomIn && onZoomOut && (
          <div className="zoom-controls">
            <button className="nav-btn zoom-btn" onClick={onZoomOut} title="Zoom Out (Ctrl+-)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button className="nav-btn zoom-btn" onClick={onZoomIn} title="Zoom In (Ctrl+=)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
          </div>
        )}

        {onToggleFindInPage && (
          <button className="action-btn" onClick={onToggleFindInPage} title="Find in Page (Ctrl+F)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        )}

        <button
          className={`action-btn bookmark-btn ${isBookmarked ? 'active' : ''}`}
          onClick={onToggleBookmark}
          title={isBookmarked ? 'Remove Bookmark (Ctrl+D)' : 'Add Bookmark (Ctrl+D)'}
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

        <button className="action-btn" onClick={onShowHistory} title="History (Ctrl+H)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>

        <button className="action-btn" onClick={onShowBookmarks} title="Bookmarks (Ctrl+B)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        <button
          className={`action-btn downloads-btn ${isDownloading ? 'downloading' : ''} ${isDownloading && downloadProgress == null ? 'indeterminate' : ''}`}
          onClick={onShowDownloads}
          title="Downloads (Ctrl+J)"
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

        <button className="action-btn" onClick={onShowSettings} title="Settings (Ctrl+,)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
