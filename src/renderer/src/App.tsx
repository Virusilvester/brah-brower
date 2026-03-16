import { useState, useEffect, useCallback, useRef, JSX } from 'react'
import { TabBar } from './components/TabBar'
import { NavigationBar } from './components/NavigationBar'
import { TitleBar } from './components/TitleBar'
import { HistoryPanel } from './components/HistoryPanel'
import { BookmarksPanel } from './components/BookmarksPanel'
import { DownloadsPanel } from './components/DownloadsPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { SiteSettingsPanel } from './components/SiteSettingsPanel'
import { WebViewContainer, WebViewRef } from './components/WebViewContainer'
import { useBrowserState } from './hooks/useBrowserState'
import { useHistory } from './hooks/useHistory'
import { useBookmarks } from './hooks/useBookmarks'
import { useDownloads } from './hooks/useDownloads'
import { useAdBlock } from './hooks/useAdBlock'
import './styles/App.css'

export interface Tab {
  id: string
  title: string
  url: string
  favicon?: string
  isLoading?: boolean
  canGoBack?: boolean
  canGoForward?: boolean
}

export type PanelType = 'history' | 'bookmarks' | 'downloads' | 'settings' | 'site-settings' | null

function App(): JSX.Element {
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [showFindBar, setShowFindBar] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const webviewRef = useRef<WebViewRef>(null)
  const findInputRef = useRef<HTMLInputElement>(null)

  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    reorderTabs,
    updateTab,
    updateTabLoading,
    updateTabNavigationState
  } = useBrowserState()

  const {
    history,
    addToHistory,
    clearHistory,
    removeFromHistory,
    removeFromHistoryByUrl,
    removeFromHistoryByHost
  } = useHistory()
  const { bookmarks, addBookmark, removeBookmark, isBookmarked, toggleBookmark } = useBookmarks()
  const {
    downloads,
    clearCompletedDownloads,
    pauseDownload,
    resumeDownload,
    removeDownload,
    deleteDownload,
    cancelDownload
  } = useDownloads()
  const {
    enabled: adBlockEnabled,
    blockedCount: adBlockCount,
    toggle: toggleAdBlock
  } = useAdBlock()

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]
  const activeDownloads = downloads.filter((d) => d.state === 'progressing')
  const isDownloading = activeDownloads.length > 0
  const downloadProgress = (() => {
    if (!isDownloading) return null
    const known = activeDownloads.filter((d) => d.totalBytes > 0)
    if (!known.length) return null
    const total = known.reduce((s, d) => s + d.totalBytes, 0)
    const received = known.reduce((s, d) => s + d.receivedBytes, 0)
    if (total <= 0) return null
    return Math.max(0, Math.min(100, Math.round((received / total) * 100)))
  })()

  // Window maximize state
  useEffect(() => {
    const cleanup = window.windowControls?.onMaximizedChange?.(setIsMaximized)
    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  // New tab from OS shortcut
  useEffect(() => {
    return window.browserEvents?.onNewTab?.(() => addTab())
  }, [addTab])

  // Internal page actions (bookmark from home page, remove most visited)
  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent).detail as any
      if (!detail) return
      if (detail.type === 'bookmark') {
        if (detail.url)
          addBookmark(detail.title || detail.url, detail.url, undefined, detail.favicon)
        window.dispatchEvent(
          new CustomEvent('brah:home-refresh', { detail: { tabId: detail.tabId } })
        )
        return
      }
      if (detail.type === 'remove-most-visited') {
        if (detail.host) removeFromHistoryByHost(detail.host)
        else if (detail.url) removeFromHistoryByUrl(detail.url)
        window.dispatchEvent(
          new CustomEvent('brah:home-refresh', { detail: { tabId: detail.tabId } })
        )
      }
    }
    window.addEventListener('brah:internal-action', handler as EventListener)
    return () => window.removeEventListener('brah:internal-action', handler as EventListener)
  }, [addBookmark, removeFromHistoryByHost, removeFromHistoryByUrl])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) {
        if (e.key === 'F5') {
          e.preventDefault()
          webviewRef.current?.reload()
        }
        if (e.key === 'Escape' && showFindBar) {
          setShowFindBar(false)
          setFindQuery('')
        }
        return
      }
      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault()
          addTab()
          break
        case 'w':
          e.preventDefault()
          closeTab(activeTabId)
          break
        case 'r':
          e.preventDefault()
          webviewRef.current?.reload()
          break
        case 'h':
          e.preventDefault()
          togglePanel('history')
          break
        case 'b':
          e.preventDefault()
          togglePanel('bookmarks')
          break
        case 'j':
          e.preventDefault()
          togglePanel('downloads')
          break
        case ',':
          e.preventDefault()
          togglePanel('settings')
          break
        case 'd':
          e.preventDefault()
          handleToggleBookmark()
          break
        case 'f':
          e.preventDefault()
          setShowFindBar((v) => !v)
          setTimeout(() => findInputRef.current?.focus(), 50)
          break
        case '=':
        case '+':
          e.preventDefault()
          handleZoomIn()
          break
        case '-':
          e.preventDefault()
          handleZoomOut()
          break
        case '0':
          e.preventDefault()
          handleZoomReset()
          break
        case 'tab':
          if (e.shiftKey) {
            e.preventDefault()
            const idx = tabs.findIndex((t) => t.id === activeTabId)
            setActiveTab(tabs[Math.max(0, idx - 1)].id)
          } else {
            e.preventDefault()
            const idx = tabs.findIndex((t) => t.id === activeTabId)
            setActiveTab(tabs[Math.min(tabs.length - 1, idx + 1)].id)
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTabId, tabs, showFindBar])

  const handleNavigate = useCallback(
    (url: string) => {
      if (!activeTabId) return
      webviewRef.current?.loadURL(url)
      addToHistory(activeTab?.title || 'New Tab', url)
    },
    [activeTabId, addToHistory, activeTab?.title]
  )

  const handleLoadURL = useCallback(
    (input: string) => {
      handleNavigate(normalizeUrl(input))
    },
    [handleNavigate]
  )

  const handleGoBack = useCallback(() => webviewRef.current?.goBack(), [])
  const handleGoForward = useCallback(() => webviewRef.current?.goForward(), [])
  const handleReload = useCallback(() => {
    if (activeTab?.isLoading) webviewRef.current?.stop()
    else webviewRef.current?.reload()
  }, [activeTab?.isLoading])

  const handleToggleBookmark = useCallback(() => {
    if (activeTab) toggleBookmark(activeTab.title, activeTab.url)
  }, [activeTab, toggleBookmark])

  const togglePanel = useCallback((panel: PanelType) => {
    setActivePanel((current) => (current === panel ? null : panel))
  }, [])

  const handleNewTab = useCallback((url: string) => addTab(url), [addTab])

  const handleZoomIn = useCallback(() => setZoomLevel((z) => Math.min(200, z + 10)), [])
  const handleZoomOut = useCallback(() => setZoomLevel((z) => Math.max(25, z - 10)), [])
  const handleZoomReset = useCallback(() => setZoomLevel(100), [])

  return (
    <div className="app">
      <TitleBar
        isMaximized={isMaximized}
        onMinimize={() => window.windowControls?.minimize()}
        onMaximize={() => window.windowControls?.maximize()}
        onClose={() => window.windowControls?.close()}
      />

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTab}
        onTabClose={closeTab}
        onAddTab={() => addTab()}
        onReorderTabs={reorderTabs}
      />

      <NavigationBar
        url={activeTab?.url || ''}
        canGoBack={activeTab?.canGoBack}
        canGoForward={activeTab?.canGoForward}
        isLoading={activeTab?.isLoading}
        isBookmarked={isBookmarked(activeTab?.url || '')}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        zoomLevel={zoomLevel}
        adBlockEnabled={adBlockEnabled}
        adBlockCount={adBlockCount}
        onBack={handleGoBack}
        onForward={handleGoForward}
        onReload={handleReload}
        onNavigate={handleLoadURL}
        onToggleBookmark={handleToggleBookmark}
        onShowHistory={() => togglePanel('history')}
        onShowBookmarks={() => togglePanel('bookmarks')}
        onShowDownloads={() => togglePanel('downloads')}
        onShowSettings={() => togglePanel('settings')}
        onShowSiteSettings={() => togglePanel('site-settings')}
        onToggleAdBlock={toggleAdBlock}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onToggleFindInPage={() => {
          setShowFindBar((v) => !v)
          setTimeout(() => findInputRef.current?.focus(), 50)
        }}
      />

      {showFindBar && (
        <div className="find-bar">
          <svg
            className="find-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={findInputRef}
            className="find-input"
            type="text"
            placeholder="Find in page…"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowFindBar(false)
                setFindQuery('')
              }
            }}
          />
          <button
            className="find-close"
            onClick={() => {
              setShowFindBar(false)
              setFindQuery('')
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className="content-area">
        <WebViewContainer
          ref={webviewRef}
          tabs={tabs}
          activeTabId={activeTabId}
          onTitleChange={(tabId, title) => updateTab(tabId, { title })}
          onFaviconChange={(tabId, favicon) => updateTab(tabId, { favicon })}
          onUrlChange={(tabId, url) => {
            updateTab(tabId, { url })
            const tab = tabs.find((t) => t.id === tabId)
            if (tab) addToHistory(tab.title, url)
          }}
          onLoadingChange={updateTabLoading}
          onNavigationStateChange={updateTabNavigationState}
          onNewTab={handleNewTab}
        />

        {activePanel && (
          <div className="side-panel">
            {activePanel === 'history' && (
              <HistoryPanel
                history={history}
                onItemClick={(url) => {
                  handleNavigate(url)
                  setActivePanel(null)
                }}
                onClear={clearHistory}
                onRemove={removeFromHistory}
                onClose={() => setActivePanel(null)}
              />
            )}
            {activePanel === 'bookmarks' && (
              <BookmarksPanel
                bookmarks={bookmarks}
                onItemClick={(url) => {
                  handleNavigate(url)
                  setActivePanel(null)
                }}
                onRemove={removeBookmark}
                onClose={() => setActivePanel(null)}
              />
            )}
            {activePanel === 'downloads' && (
              <DownloadsPanel
                downloads={downloads}
                onOpenFile={(path) => window.downloads?.openFile(path)}
                onShowInFolder={(path) => window.downloads?.showInFolder(path)}
                onClearCompleted={clearCompletedDownloads}
                onPause={pauseDownload}
                onResume={resumeDownload}
                onCancel={cancelDownload}
                onRemove={removeDownload}
                onDelete={deleteDownload}
                onClose={() => setActivePanel(null)}
              />
            )}
            {activePanel === 'settings' && <SettingsPanel onClose={() => setActivePanel(null)} />}
            {activePanel === 'site-settings' && (
              <SiteSettingsPanel url={activeTab?.url || ''} onClose={() => setActivePanel(null)} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed || trimmed === 'brah://home') return 'brah://home'
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('brah://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('chrome://')
  )
    return trimmed
  if (trimmed.includes('.') && !trimmed.includes(' ')) return `https://${trimmed}`
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

export default App
