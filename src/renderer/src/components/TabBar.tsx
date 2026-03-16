import { useState, useRef, JSX } from 'react'
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
  onReorderTabs: (dragIndex: number, hoverIndex: number) => void
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onAddTab,
  onReorderTabs
}: TabBarProps): JSX.Element {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragCounter = useRef(0)

  const handleDragStart = (e: React.DragEvent, tabId: string): void => {
    setDraggedTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tabId)
    setTimeout(() => {
      const element = e.target as HTMLElement
      element.classList.add('dragging')
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent): void => {
    const element = e.target as HTMLElement
    element.classList.remove('dragging')
    setDraggedTabId(null)
    setDragOverIndex(null)
    dragCounter.current = 0
  }

  const handleDragOver = (e: React.DragEvent, index: number): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedTabId === null) return
    const dragIndex = tabs.findIndex((t) => t.id === draggedTabId)
    if (dragIndex === index) return
    setDragOverIndex(index)
  }

  const handleDragEnter = (e: React.DragEvent, index: number): void => {
    e.preventDefault()
    dragCounter.current++
    if (draggedTabId === null) return
    setDragOverIndex(index)
  }

  const handleDragLeave = (): void => {
    dragCounter.current--
    if (dragCounter.current === 0) setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number): void => {
    e.preventDefault()
    e.stopPropagation()
    const tabId = e.dataTransfer.getData('text/plain') || draggedTabId
    if (!tabId) return
    const dragIndex = tabs.findIndex((t) => t.id === tabId)
    if (dragIndex === -1 || dragIndex === dropIndex) return
    onReorderTabs(dragIndex, dropIndex)
    setDragOverIndex(null)
    dragCounter.current = 0
  }

  return (
    <div
      className="tab-bar"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        setDragOverIndex(null)
        dragCounter.current = 0
      }}
    >
      <div className="tabs-container">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onClick={() => onTabSelect(tab.id)}
            title={tab.title + '\n' + tab.url}
            className={[
              'tab',
              tab.id === activeTabId ? 'active' : '',
              tab.id === draggedTabId ? 'dragging' : '',
              dragOverIndex === index ? 'drag-over' : ''
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {tab.isLoading && <div className="tab-spinner" />}
            {!tab.isLoading && tab.favicon && (
              <img
                src={tab.favicon}
                alt=""
                className="tab-favicon"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            {!tab.isLoading && !tab.favicon && <div className="tab-favicon-default">🌐</div>}

            <span className="tab-title">{tab.title || 'New Tab'}</span>

            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.id)
              }}
              title="Close tab"
              aria-label="Close tab"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button className="add-tab-btn" onClick={onAddTab} title="New Tab (Ctrl+T)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
