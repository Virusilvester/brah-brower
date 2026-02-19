/* eslint-disable no-empty */
/* eslint-disable react/no-unknown-property */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { useRef, useEffect } from 'react'
import type { Tab } from '../App'
import '../styles/WebViewContainer.css'

interface WebViewContainerProps {
  tabs: Tab[]
  activeTabId: string
  onTitleChange: (tabId: string, title: string) => void
  onFaviconChange: (tabId: string, favicon: string) => void
  onUrlChange: (tabId: string, url: string) => void
  onLoadingChange: (tabId: string, isLoading: boolean) => void
  onNavigationStateChange: (tabId: string, canGoBack: boolean, canGoForward: boolean) => void
}

// Individual WebView component to isolate lifecycle
function WebView({
  tab,
  isActive,
  onTitleChange,
  onFaviconChange,
  onUrlChange,
  onLoadingChange,
  onNavigationStateChange
}: {
  tab: Tab
  isActive: boolean
  onTitleChange: (id: string, title: string) => void
  onFaviconChange: (id: string, favicon: string) => void
  onUrlChange: (id: string, url: string) => void
  onLoadingChange: (id: string, loading: boolean) => void
  onNavigationStateChange: (id: string, back: boolean, forward: boolean) => void
}) {
  const webviewRef = useRef<Electron.WebviewTag>(null)

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleFinish = () => {
      onTitleChange(tab.id, webview.getTitle())
      onUrlChange(tab.id, webview.getURL())
      onLoadingChange(tab.id, false)
      onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
    }

    const handleStart = () => onLoadingChange(tab.id, true)
    const handleStop = () => {
      onLoadingChange(tab.id, false)
      onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
    }

    const handleNavigate = () => {
      onUrlChange(tab.id, webview.getURL())
      onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
    }

    const handleFavicon = (e: any) => {
      if (e.favicons?.[0]) onFaviconChange(tab.id, e.favicons[0])
    }

    webview.addEventListener('did-finish-load', handleFinish)
    webview.addEventListener('did-start-loading', handleStart)
    webview.addEventListener('did-stop-loading', handleStop)
    webview.addEventListener('did-navigate', handleNavigate)
    webview.addEventListener('page-favicon-updated', handleFavicon)
    webview.addEventListener('new-window', (e) => e.preventDefault())

    // Force load if blank after a short delay
    const timer = setTimeout(() => {
      try {
        if (!webview.getURL() || webview.getURL() === 'about:blank') {
          webview.src = tab.url
        }
      } catch (e) {}
    }, 100)

    return () => {
      clearTimeout(timer)
      webview.removeEventListener('did-finish-load', handleFinish)
      webview.removeEventListener('did-start-loading', handleStart)
      webview.removeEventListener('did-stop-loading', handleStop)
      webview.removeEventListener('did-navigate', handleNavigate)
      webview.removeEventListener('page-favicon-updated', handleFavicon)
    }
  }, [tab.id]) // Only re-run if tab ID changes

  return (
    <webview
      ref={webviewRef}
      src={tab.url}
      className="webview"
      style={{ display: isActive ? 'flex' : 'none' }}
      allowpopups={'false' as any}
      nodeintegration={'false' as any}
      webpreferences="contextIsolation=true, nodeIntegration=false"
    />
  )
}

export function WebViewContainer(props: WebViewContainerProps) {
  return (
    <div className="webview-container">
      {props.tabs.map((tab) => (
        <WebView key={tab.id} tab={tab} isActive={tab.id === props.activeTabId} {...props} />
      ))}
    </div>
  )
}
