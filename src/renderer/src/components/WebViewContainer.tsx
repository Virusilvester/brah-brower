import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import type { JSX } from 'react'
import type { Tab } from '../App'
import '../styles/WebViewContainer.css'

export interface WebViewRef {
  goBack: () => void
  goForward: () => void
  reload: () => void
  stop: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  getURL: () => string
  loadURL: (url: string) => void
}

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

export const WebViewContainer = forwardRef<WebViewRef, WebViewContainerProps>(
  function WebViewContainer(props, ref) {
    const webviewRefs = useRef<Map<string, Electron.WebviewTag>>(new Map())

    // Listen for new tab requests from main process (context menu)
    useEffect(() => {
      if (!props.onNewTab) return
      return window.browserEvents?.onWebviewNewTab((url) => props.onNewTab?.(url))
    }, [props.onNewTab])

    // Expose methods to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        goBack: () => {
          const webview = webviewRefs.current.get(props.activeTabId)
          if (webview && webview.canGoBack()) {
            webview.goBack()
          }
        },
        goForward: () => {
          const webview = webviewRefs.current.get(props.activeTabId)
          if (webview && webview.canGoForward()) {
            webview.goForward()
          }
        },
        reload: () => {
          const webview = webviewRefs.current.get(props.activeTabId)
          if (webview) {
            webview.reload()
          }
        },
        stop: () => {
          const webview = webviewRefs.current.get(props.activeTabId)
          if (webview) {
            webview.stop()
          }
        },
        canGoBack: () => {
          const webview = webviewRefs.current.get(props.activeTabId)
          return webview?.canGoBack() ?? false
        },
        canGoForward: () => {
          const webview = webviewRefs.current.get(props.activeTabId)
          return webview?.canGoForward() ?? false
        },
        getURL: () => {
          const webview = webviewRefs.current.get(props.activeTabId)
          return webview?.getURL() ?? ''
        },
        loadURL: (url: string) => {
          const webview = webviewRefs.current.get(props.activeTabId)
          if (webview) {
            webview.loadURL(url)
          }
        }
      }),
      [props.activeTabId]
    )

    return (
      <div className="webview-container">
        {props.tabs.map((tab) => (
          <WebViewInstance
            key={tab.id}
            tab={tab}
            isActive={tab.id === props.activeTabId}
            webviewRefs={webviewRefs}
            {...props}
          />
        ))}
      </div>
    )
  }
)

interface WebViewInstanceProps extends WebViewContainerProps {
  tab: Tab
  isActive: boolean
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>
}

function WebViewInstance({
  tab,
  isActive,
  webviewRefs,
  onTitleChange,
  onFaviconChange,
  onUrlChange,
  onLoadingChange,
  onNavigationStateChange,
  onNewTab
}: WebViewInstanceProps): JSX.Element {
  const webviewRef = useRef<Electron.WebviewTag>(null)
  const isInitialized = useRef(false)

  const webviewExtraProps = {
    allowpopups: true,
    nodeintegration: false,
    webpreferences: 'contextIsolation=true,nodeIntegration=false,sandbox=true',
    partition: `persist:tab-${tab.id}`
  } as any

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview || isInitialized.current) return

    isInitialized.current = true
    webviewRefs.current.set(tab.id, webview)

    const handlers: Record<string, (e: any) => void> = {
      'did-start-loading': () => onLoadingChange(tab.id, true),
      'did-stop-loading': () => {
        onLoadingChange(tab.id, false)
        try {
          onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
        } catch (e) {
          console.error('Navigation state error:', e)
        }
      },
      'did-finish-load': () => {
        try {
          onTitleChange(tab.id, webview.getTitle())
          onUrlChange(tab.id, webview.getURL())
          onLoadingChange(tab.id, false)
          onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
        } catch (err) {
          console.error('Load finish error:', err)
        }
      },
      'did-navigate': (e) => {
        onUrlChange(tab.id, e.url)
        try {
          onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
        } catch (e) {
          console.error('Navigate error:', e)
        }
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
        // Webview is ready
      },
      // Handle context menu events from main process
      'context-menu': (e) => {
        // The main process handles the actual menu, but we can log or handle custom actions here
        console.log('Context menu triggered', e)
      }
    }

    Object.entries(handlers).forEach(([event, handler]) => {
      webview.addEventListener(event as any, handler)
    })

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        webview.removeEventListener(event as any, handler)
      })
      webviewRefs.current.delete(tab.id)
    }
  }, [tab.id])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    if (isActive) {
      webview.style.display = 'flex'
      webview.style.zIndex = '1'

      // Sync URL if changed externally
      try {
        const currentUrl = webview.getURL()
        if (currentUrl && currentUrl !== tab.url && tab.url !== 'about:blank') {
          webview.loadURL(tab.url)
        }
      } catch (e) {
        console.error('URL sync error:', e)
      }
    } else {
      webview.style.display = 'none'
      webview.style.zIndex = '0'
    }
  }, [isActive, tab.url])

  return (
    <webview
      {...webviewExtraProps}
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
    />
  )
}
