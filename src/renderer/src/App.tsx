import { useState, useEffect, useCallback, useRef, JSX } from 'react'
import { TabBar } from './components/TabBar'
import { NavigationBar } from './components/NavigationBar'
import { TitleBar } from './components/TitleBar'
import { HistoryPanel } from './components/HistoryPanel'
import { BookmarksPanel } from './components/BookmarksPanel'
import { DownloadsPanel } from './components/DownloadsPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { WebViewContainer, WebViewRef } from './components/WebViewContainer'
import { useBrowserState } from './hooks/useBrowserState'
import { useHistory } from './hooks/useHistory'
import { useBookmarks } from './hooks/useBookmarks'
import { useDownloads } from './hooks/useDownloads'
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

export type PanelType = 'history' | 'bookmarks' | 'downloads' | 'settings' | null

function App(): JSX.Element {
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const webviewRef = useRef<WebViewRef>(null)

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

  const { history, addToHistory, clearHistory, removeFromHistory } = useHistory()

  const { bookmarks, removeBookmark, isBookmarked, toggleBookmark } = useBookmarks()

  const { downloads, clearCompletedDownloads, pauseDownload, resumeDownload, cancelDownload } =
    useDownloads()

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]

  useEffect(() => {
    const cleanup = window.windowControls?.onMaximizedChange?.(setIsMaximized)
    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  const handleNavigate = useCallback(
    (url: string) => {
      if (!activeTabId) return
      if (webviewRef.current) {
        webviewRef.current.loadURL(url)
      }
      addToHistory(activeTab?.title || 'New Tab', url)
    },
    [activeTabId, addToHistory, activeTab?.title]
  )

  const handleLoadURL = useCallback(
    (input: string) => {
      const url = normalizeUrl(input)
      handleNavigate(url)
    },
    [handleNavigate]
  )

  const handleGoBack = useCallback(() => {
    webviewRef.current?.goBack()
  }, [])

  const handleGoForward = useCallback(() => {
    webviewRef.current?.goForward()
  }, [])

  const handleReload = useCallback(() => {
    if (activeTab?.isLoading) {
      webviewRef.current?.stop()
    } else {
      webviewRef.current?.reload()
    }
  }, [activeTab?.isLoading])

  const handleToggleBookmark = useCallback(() => {
    if (activeTab) {
      toggleBookmark(activeTab.title, activeTab.url)
    }
  }, [activeTab, toggleBookmark])

  const togglePanel = useCallback((panel: PanelType) => {
    setActivePanel((current) => (current === panel ? null : panel))
  }, [])

  const handleNewTab = useCallback(
    (url: string) => {
      addTab(url)
    },
    [addTab]
  )

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
        onBack={handleGoBack}
        onForward={handleGoForward}
        onReload={handleReload}
        onNavigate={handleLoadURL}
        onToggleBookmark={handleToggleBookmark}
        onShowHistory={() => togglePanel('history')}
        onShowBookmarks={() => togglePanel('bookmarks')}
        onShowDownloads={() => togglePanel('downloads')}
        onShowSettings={() => togglePanel('settings')}
      />

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
                onClose={() => setActivePanel(null)}
              />
            )}

            {activePanel === 'settings' && <SettingsPanel onClose={() => setActivePanel(null)} />}
          </div>
        )}
      </div>
    </div>
  )
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim()

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  if (trimmed.includes('.') && !trimmed.includes(' ') && !trimmed.startsWith(' ')) {
    return `https://${trimmed}`
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

export default App
