import type { BookmarkItem } from '../hooks/useBookmarks'
import '../styles/Panel.css'

interface BookmarksPanelProps {
  bookmarks: BookmarkItem[]
  onItemClick: (url: string) => void
  onRemove: (id: string) => void
  onClose: () => void
}

export function BookmarksPanel({ bookmarks, onItemClick, onRemove, onClose }: BookmarksPanelProps) {
  return (
    <div className="panel bookmarks-panel">
      <div className="panel-header">
        <h3>Bookmarks ({bookmarks.length})</h3>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="panel-content">
        {bookmarks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⭐</div>
            <p>No bookmarks yet</p>
            <small>Click the star icon in the address bar to bookmark a page</small>
          </div>
        ) : (
          bookmarks.map((bookmark) => (
            <div key={bookmark.id} className="bookmark-item">
              <div className="bookmark-content" onClick={() => onItemClick(bookmark.url)}>
                {bookmark.favicon ? (
                  <img src={bookmark.favicon} alt="" className="bookmark-favicon" />
                ) : (
                  <div className="bookmark-favicon-default">🌐</div>
                )}
                <div className="bookmark-info">
                  <div className="bookmark-title">{bookmark.title}</div>
                  <div className="bookmark-url">{bookmark.url}</div>
                </div>
              </div>
              <button
                className="remove-btn"
                onClick={() => onRemove(bookmark.id)}
                title="Remove bookmark"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
