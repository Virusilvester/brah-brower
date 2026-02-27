import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import type { JSX } from 'react'
import type { Tab } from '../App'
import '../styles/WebViewContainer.css'
import { getLoadErrorUrl, isInternalDataUrl, resolveInternalUrl } from '../utils/internalPages'

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

type InternalAction =
  | { type: 'bookmark'; tabId: string; url: string; title?: string; favicon?: string }
  | { type: 'remove-most-visited'; tabId: string; url?: string; host?: string }

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
            webview.loadURL(resolveInternalUrl(url))
          }
        }
      }),
      [props.activeTabId]
    )

    useEffect(() => {
      const handler = (e: Event): void => {
        const detail = (e as CustomEvent).detail as { tabId?: string } | undefined
        const tabId = detail?.tabId
        if (!tabId) return
        const webview = webviewRefs.current.get(tabId)
        if (!webview) return
        webview.loadURL(resolveInternalUrl('brah://home'))
      }

      window.addEventListener('brah:home-refresh', handler as EventListener)
      return () => window.removeEventListener('brah:home-refresh', handler as EventListener)
    }, [])

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
  const isShowingInternalErrorPage = useRef(false)

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
        isShowingInternalErrorPage.current = false
        try {
          onTitleChange(tab.id, webview.getTitle())
          const current = webview.getURL()
          if (!isInternalDataUrl(current)) {
            onUrlChange(tab.id, current)
          }
          onLoadingChange(tab.id, false)
          onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
        } catch (err) {
          console.error('Load finish error:', err)
        }
      },
      'did-fail-provisional-load': (e) => {
        // Ignore aborts (happens on redirects / user navigation).
        if (e?.errorCode === -3) return
        if (e?.isMainFrame === false) return
        if (typeof e?.validatedURL === 'string' && isInternalDataUrl(e.validatedURL)) {
          return
        }
        const attemptedUrl = (typeof e?.validatedURL === 'string' && e.validatedURL) || tab.url
        onLoadingChange(tab.id, false)
        onUrlChange(tab.id, attemptedUrl)
        if (isShowingInternalErrorPage.current) return
        isShowingInternalErrorPage.current = true
        const errorUrl = getLoadErrorUrl({
          attemptedUrl,
          errorCode: Number(e?.errorCode ?? -1),
          errorDescription: typeof e?.errorDescription === 'string' ? e.errorDescription : undefined
        })
        webview.loadURL(errorUrl)
      },
      'did-fail-load': (e) => {
        if (e?.errorCode === -3) return
        if (e?.isMainFrame === false) return
        if (typeof e?.validatedURL === 'string' && isInternalDataUrl(e.validatedURL)) {
          return
        }
        const attemptedUrl = (typeof e?.validatedURL === 'string' && e.validatedURL) || tab.url
        onLoadingChange(tab.id, false)
        onUrlChange(tab.id, attemptedUrl)
        if (isShowingInternalErrorPage.current) return
        isShowingInternalErrorPage.current = true
        const errorUrl = getLoadErrorUrl({
          attemptedUrl,
          errorCode: Number(e?.errorCode ?? -1),
          errorDescription: typeof e?.errorDescription === 'string' ? e.errorDescription : undefined
        })
        webview.loadURL(errorUrl)
      },
      'did-navigate': (e) => {
        if (!isInternalDataUrl(e.url)) {
          onUrlChange(tab.id, e.url)
        }
        try {
          onNavigationStateChange(tab.id, webview.canGoBack(), webview.canGoForward())
        } catch (e) {
          console.error('Navigate error:', e)
        }
      },
      'did-navigate-in-page': (e) => {
        if (!isInternalDataUrl(e.url)) {
          onUrlChange(tab.id, e.url)
        }
      },
      'page-favicon-updated': (e) => {
        if (e.favicons?.[0]) onFaviconChange(tab.id, e.favicons[0])
      },
      'new-window': (e) => {
        e.preventDefault()
        if (e.url && e.url !== 'about:blank') {
          if (typeof e.url === 'string' && e.url.startsWith('brah://')) {
            webview.loadURL(resolveInternalUrl(e.url))
            return
          }
          if (onNewTab && (e.disposition === 'new-window' || e.disposition === 'foreground-tab')) {
            onNewTab(e.url)
          } else {
            webview.loadURL(e.url)
          }
        }
      },
      'will-navigate': (e) => {
        if (typeof e?.url === 'string' && e.url.startsWith('brah://')) {
          try {
            const u = new URL(e.url)
            if (u.hostname === 'bookmark') {
              e.preventDefault()
              const url = u.searchParams.get('url') ?? ''
              const title = u.searchParams.get('title') ?? undefined
              const favicon = u.searchParams.get('favicon') ?? undefined
              const detail: InternalAction = {
                type: 'bookmark',
                tabId: tab.id,
                url,
                title,
                favicon
              }
              window.dispatchEvent(new CustomEvent('brah:internal-action', { detail }))
              return
            }
            if (u.hostname === 'remove-most-visited') {
              e.preventDefault()
              const url = u.searchParams.get('url') ?? undefined
              const host = u.searchParams.get('host') ?? undefined
              const detail: InternalAction = {
                type: 'remove-most-visited',
                tabId: tab.id,
                url,
                host
              }
              window.dispatchEvent(new CustomEvent('brah:internal-action', { detail }))
              return
            }
            if (u.hostname === 'home') {
              // Let the app handle brah://home (it resolves to internal data URL).
              e.preventDefault()
              webview.loadURL(resolveInternalUrl('brah://home'))
              return
            }
          } catch {
            // ignore
          }
        }
        if (!isInternalDataUrl(e.url)) {
          onUrlChange(tab.id, e.url)
        }
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
        const targetUrl = resolveInternalUrl(tab.url)
        if (currentUrl && currentUrl !== targetUrl && tab.url !== 'about:blank') {
          webview.loadURL(targetUrl)
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
      src={resolveInternalUrl(tab.url)}
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
