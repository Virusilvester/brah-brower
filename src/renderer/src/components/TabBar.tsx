import '../styles/TabBar.css'

interface Tab {
  id: string
  title: string
  url: string
  favicon?: string
  isLoading?: boolean
}

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  onTabSelect: (id: string) => void
  onTabClose: (id: string) => void
  onAddTab: () => void
}

export function TabBar({ tabs, activeTabId, onTabSelect, onTabClose, onAddTab }: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tabs-container">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => onTabSelect(tab.id)}
          >
            {tab.isLoading && <div className="tab-spinner" />}
            {!tab.isLoading && tab.favicon && (
              <img src={tab.favicon} alt="" className="tab-favicon" />
            )}
            {!tab.isLoading && !tab.favicon && <div className="tab-favicon-default">🌐</div>}

            <span className="tab-title">{tab.title}</span>

            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button className="add-tab-btn" onClick={onAddTab} title="New Tab">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
