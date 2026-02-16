import { useEffect, useRef, useState } from 'react'

interface Tab {
  id: number
  title: string
  url: string
}

interface HistoryItem {
  title: string
  url: string
  time: number
}

interface BookmarkItem {
  title: string
  url: string
}

function App(): React.JSX.Element {
  const HOME = 'https://www.google.com'

  const [tabs, setTabs] = useState<Tab[]>([{ id: Date.now(), title: 'New Tab', url: HOME }])

  const [activeTabId, setActiveTabId] = useState<number>(tabs[0].id)
  const [inputUrl, setInputUrl] = useState('')

  const webviewRefs = useRef<{ [key: number]: any }>({})

  const activeTab = tabs.find((t) => t.id === activeTabId)!

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)

  const [downloads, setDownloads] = useState<any[]>([])
  const [showDownloads, setShowDownloads] = useState(false)

  // 🔥 Load saved data
  useEffect(() => {
    const savedHistory = localStorage.getItem('brah-history')
    const savedBookmarks = localStorage.getItem('brah-bookmarks')

    if (savedHistory) setHistory(JSON.parse(savedHistory))
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks))
    window.downloads.onProgress((data) => {
      setDownloads((prev) => {
        const existing = prev.find((d) => d.fileName === data.fileName)

        if (existing) {
          return prev.map((d) =>
            d.fileName === data.fileName ? { ...d, progress: data.progress } : d
          )
        }

        return [...prev, { fileName: data.fileName, progress: data.progress }]
      })
    })

    window.downloads.onComplete((data) => {
      setDownloads((prev) =>
        prev.map((d) =>
          d.fileName === data.fileName ? { ...d, progress: 100, completed: true } : d
        )
      )
    })
  }, [])

  // 🔥 Add new tab
  const addTab = () => {
    const newTab: Tab = {
      id: Date.now(),
      title: 'New Tab',
      url: HOME
    }

    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setInputUrl('')
  }

  // 🔥 Close tab
  const closeTab = (id: number) => {
    if (tabs.length === 1) return

    const newTabs = tabs.filter((t) => t.id !== id)
    setTabs(newTabs)

    if (id === activeTabId) {
      setActiveTabId(newTabs[0].id)
    }
  }

  // 🔥 Load URL
  const loadURL = (customUrl?: string) => {
    let value = customUrl ?? inputUrl
    value = value.trim()

    if (!value) return

    // If it already has protocol
    if (value.startsWith('http://') || value.startsWith('https://')) {
      updateTab(value)
      return
    }

    // If it looks like a domain (contains dot and no spaces)
    const looksLikeDomain = value.includes('.') && !value.includes(' ') && !value.startsWith(' ')

    if (looksLikeDomain) {
      updateTab('https://' + value)
    } else {
      updateTab('https://www.google.com/search?q=' + encodeURIComponent(value))
    }
  }

  const updateTab = (url: string) => {
    setTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? { ...tab, url } : tab)))
  }

  const goBack = () => webviewRefs.current[activeTabId]?.goBack()
  const goForward = () => webviewRefs.current[activeTabId]?.goForward()
  const reload = () => webviewRefs.current[activeTabId]?.reload()

  // 🔥 Handle page load events (history + title update)
  const handleDidFinishLoad = (tabId: number) => {
    const webview = webviewRefs.current[tabId]
    if (!webview) return

    const title = webview.getTitle()
    const url = webview.getURL()

    // Update tab title
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, title, url } : tab)))

    // Prevent duplicate consecutive history entries
    setHistory((prev) => {
      if (prev.length > 0 && prev[0].url === url) {
        return prev
      }

      const newEntry: HistoryItem = {
        title,
        url,
        time: Date.now()
      }

      const updated = [newEntry, ...prev]
      localStorage.setItem('brah-history', JSON.stringify(updated))
      return updated
    })
  }

  // 🔥 Add bookmark
  const addBookmark = () => {
    const webview = webviewRefs.current[activeTabId]
    if (!webview) return

    const newBookmark: BookmarkItem = {
      title: webview.getTitle(),
      url: webview.getURL()
    }

    setBookmarks((prev) => {
      const updated = [...prev, newBookmark]
      localStorage.setItem('brah-bookmarks', JSON.stringify(updated))
      return updated
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 🔥 CUSTOM TITLEBAR */}
      <div
        style={{
          height: '35px',
          background: '#111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          WebkitAppRegion: 'drag'
        }}
      >
        <div style={{ color: 'white', fontWeight: 'bold' }}>{activeTab.title}</div>

        <div style={{ display: 'flex', gap: '10px', WebkitAppRegion: 'no-drag' }}>
          <button onClick={() => window.api.minimize()}>—</button>
          <button onClick={() => window.api.maximize()}>☐</button>
          <button onClick={() => window.api.close()}>✕</button>
        </div>
      </div>

      {/* 🔥 TAB BAR */}
      <div style={{ display: 'flex', background: '#111', padding: '4px' }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => {
              setActiveTabId(tab.id)
              setInputUrl(tab.url)
            }}
            style={{
              padding: '6px 12px',
              marginRight: '4px',
              background: tab.id === activeTabId ? '#333' : '#222',
              color: 'white',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span style={{ marginRight: '8px' }}>{tab.title}</span>

            <span
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
              style={{ color: 'red', cursor: 'pointer' }}
            >
              ✕
            </span>
          </div>
        ))}

        <button onClick={addTab}>＋</button>
      </div>

      {/* 🔥 NAV BAR */}
      <div style={{ display: 'flex', padding: '8px', background: '#181818' }}>
        <button onClick={goBack}>⬅</button>
        <button onClick={goForward}>➡</button>
        <button onClick={reload}>🔄</button>

        <input
          style={{
            flex: 1,
            marginLeft: '8px',
            padding: '6px',
            borderRadius: '4px',
            border: 'none'
          }}
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadURL()}
        />

        <button onClick={loadURL} style={{ marginLeft: '6px' }}>
          Go
        </button>
        <button onClick={() => setShowDownloads(!showDownloads)}>📥</button>

        <button onClick={addBookmark} style={{ marginLeft: '6px' }}>
          ⭐
        </button>

        <button onClick={() => setShowHistory(!showHistory)}>📜</button>
        <button onClick={() => setShowBookmarks(!showBookmarks)}>📂</button>
      </div>

      {/* 🔥 HISTORY PANEL */}
      {showHistory && (
        <div style={panelStyle}>
          <h3>History</h3>
          {history.map((item, index) => (
            <div
              key={index}
              style={itemStyle}
              onClick={() => {
                setShowHistory(false)
                loadURL(item.url)
              }}
            >
              {item.title}
            </div>
          ))}
        </div>
      )}

      {/* 🔥 BOOKMARK PANEL */}
      {showBookmarks && (
        <div style={panelStyle}>
          <h3>Bookmarks</h3>
          {bookmarks.map((item, index) => (
            <div
              key={index}
              style={{ ...itemStyle, display: 'flex', justifyContent: 'space-between' }}
            >
              <span
                onClick={() => {
                  setShowBookmarks(false)
                  loadURL(item.url)
                }}
              >
                {item.title}
              </span>

              <span
                style={{ color: 'red', cursor: 'pointer' }}
                onClick={() => {
                  const updated = bookmarks.filter((_, i) => i !== index)
                  setBookmarks(updated)
                  localStorage.setItem('brah-bookmarks', JSON.stringify(updated))
                }}
              >
                ✕
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 🔥 WEBVIEWS */}
      <div style={{ flex: 1 }}>
        {tabs.map((tab) => (
          <webview
            key={tab.id}
            ref={(el) => (webviewRefs.current[tab.id] = el)}
            src={tab.url}
            style={{
              width: '100%',
              height: '100%',
              display: tab.id === activeTabId ? 'flex' : 'none'
            }}
            onDidFinishLoad={() => handleDidFinishLoad(tab.id)}
          />
        ))}

        {showDownloads && (
          <div style={panelStyle}>
            <h3>Downloads</h3>

            {downloads.length === 0 && <p>No downloads yet</p>}

            {downloads.map((item, index) => (
              <div key={index} style={{ marginBottom: '10px' }}>
                <div>{item.fileName}</div>

                <div
                  style={{
                    height: '6px',
                    background: '#333',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${item.progress || 0}%`,
                      height: '100%',
                      background: item.completed ? 'limegreen' : 'dodgerblue'
                    }}
                  />
                </div>

                <small>{item.progress || 0}%</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '120px',
  right: '10px',
  width: '300px',
  height: '400px',
  background: '#1e1e1e',
  overflowY: 'auto',
  padding: '10px',
  zIndex: 999,
  color: 'white'
}

const itemStyle: React.CSSProperties = {
  marginBottom: '8px',
  cursor: 'pointer'
}

export default App
