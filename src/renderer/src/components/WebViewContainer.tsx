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
  onNewTab?: (url: string) => void
}

export function WebViewContainer(props: WebViewContainerProps) {
  return (
    <div className="webview-container">
      {props.tabs.map((tab) => (
        <WebViewInstance
          key={tab.id}
          tab={tab}
          isActive={tab.id === props.activeTabId}
          {...props}
        />
      ))}
    </div>
  )
}

function WebViewInstance({
  tab,
  isActive,
  onTitleChange,
  onFaviconChange,
  onUrlChange,
  onLoadingChange,
  onNavigationStateChange,
  onNewTab
}: {
  tab: Tab
  isActive: boolean
} & WebViewContainerProps) {
  const webviewRef = useRef<Electron.WebviewTag>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview || isInitialized.current) return

    isInitialized.current = true

    const handlers: Record<string, (e: any) => void> = {
      'did-start-loading': () => onLoadingChange(tab.id, true),
      'did-stop-loading': () => {
        onLoadingChange(tab.id, false)
        try {
          onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
        } catch (e) {}
      },
      'did-finish-load': () => {
        try {
          onTitleChange(tab.id, webview.getTitle())
          onUrlChange(tab.id, webview.getURL())
          onLoadingChange(tab.id, false)
          onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
        } catch (err) {
          console.error(err)
        }
      },
      'did-navigate': (e) => {
        onUrlChange(tab.id, e.url)
        try {
          onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
        } catch (e) {}
      },
      'did-navigate-in-page': (e) => {
        onUrlChange(tab.id, e.url)
      },
      'page-favicon-updated': (e) => {
        if (e.favicons?.[0]) onFaviconChange(tab.id, e.favicons[0])
      },
      'new-window': (e) => {
        e.preventDefault()
        if (e.url && e.url !== 'about:blank') {
          if (onNewTab && (e.disposition === 'new-window' || e.disposition === 'foreground-tab')) {
            onNewTab(e.url)
          } else {
            webview.loadURL(e.url)
          }
        }
      },
      'will-navigate': (e) => {
        onUrlChange(tab.id, e.url)
      },
      'dom-ready': () => {
        try {
          if (!webview.getURL() || webview.getURL() === 'about:blank') {
            setTimeout(() => {
              webview.reload()
            }, 100)
          }
        } catch (e) {}
      }
    }

    Object.entries(handlers).forEach(([event, handler]) => {
      webview.addEventListener(event as any, handler)
    })

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        webview.removeEventListener(event as any, handler)
      })
    }
  }, [tab.id])

  // CRITICAL FIX: Handle visibility and URL updates when active state changes
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    if (isActive) {
      // Make visible
      webview.style.display = 'flex'
      webview.style.zIndex = '1'

      // Force URL check when becoming active
      try {
        const currentUrl = webview.getURL()
        if (currentUrl !== tab.url) {
          webview.src = tab.url
        }
      } catch (e) {
        webview.src = tab.url
      }
    } else {
      // Hide when not active
      webview.style.display = 'none'
      webview.style.zIndex = '0'
    }
  }, [isActive, tab.url])

  return (
    <webview
      ref={webviewRef}
      src={tab.url}
      className="webview"
      style={{
        display: isActive ? 'flex' : 'none',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        background: 'white'
      }}
      allowpopups="true"
      nodeintegration="false"
      webpreferences="contextIsolation=true,nodeIntegration=false"
      partition="persist:webcontent"
    />
  )
}
