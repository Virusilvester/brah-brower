import { useState } from 'react'
import type { HistoryItem } from '../hooks/useHistory'
import '../styles/Panel.css'

interface HistoryPanelProps {
  history: HistoryItem[]
  onItemClick: (url: string) => void
  onClear: () => void
  onRemove: (id: string) => void
  onClose: () => void
}

export function HistoryPanel({
  history,
  onItemClick,
  onClear,
  onRemove,
  onClose
}: HistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredHistory = searchQuery
    ? history.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.url.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : history

  const groupByDate = (items: HistoryItem[]) => {
    const groups: { [key: string]: HistoryItem[] } = {}

    items.forEach((item) => {
      const date = new Date(item.timestamp).toLocaleDateString()
      if (!groups[date]) groups[date] = []
      groups[date].push(item)
    })

    return groups
  }

  const grouped = groupByDate(filteredHistory)

  return (
    <div className="panel history-panel">
      <div className="panel-header">
        <h3>History</h3>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="panel-search">
        <input
          type="text"
          placeholder="Search history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="panel-actions">
        <button onClick={onClear} className="clear-btn">
          Clear All History
        </button>
      </div>

      <div className="panel-content">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="history-group">
            <div className="history-date">{date}</div>
            {items.map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-item-content" onClick={() => onItemClick(item.url)}>
                  <div className="history-title">{item.title}</div>
                  <div className="history-url">{item.url}</div>
                  <div className="history-time">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <button className="remove-btn" onClick={() => onRemove(item.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}

        {filteredHistory.length === 0 && <div className="empty-state">No history found</div>}
      </div>
    </div>
  )
}
