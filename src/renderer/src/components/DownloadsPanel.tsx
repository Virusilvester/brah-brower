import { JSX } from 'react'
import type { DownloadItem } from '../../../preload/index.d'
import '../styles/Panel.css'

interface DownloadsPanelProps {
  downloads: DownloadItem[]
  onOpenFile: (path: string) => void
  onShowInFolder: (path: string) => void
  onClearCompleted: () => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onDelete: (id: string, path: string) => void
  onClose: () => void
}

export function DownloadsPanel({
  downloads,
  onOpenFile,
  onShowInFolder,
  onClearCompleted,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onDelete,
  onClose
}: DownloadsPanelProps): JSX.Element {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="panel downloads-panel">
      <div className="panel-header">
        <h3>Downloads ({downloads.length})</h3>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="panel-actions">
        <button onClick={onClearCompleted} className="clear-btn">
          Clear Completed
        </button>
      </div>

      <div className="panel-content">
        {downloads.map((download) => (
          <div key={download.id} className="download-item">
            <div className="download-info">
              <div className="download-filename" title={download.fileName}>
                {download.fileName}
              </div>
              <div className="download-meta">
                {download.state === 'progressing' && (
                  <span>
                    {formatBytes(download.receivedBytes)} / {formatBytes(download.totalBytes)}
                    {download.paused && ' (Paused)'}
                  </span>
                )}
                {download.state === 'completed' && <span className="completed">Completed</span>}
                {download.state === 'cancelled' && <span className="cancelled">Cancelled</span>}
                {download.state === 'interrupted' && <span className="error">Failed</span>}
              </div>
            </div>

            {download.state === 'progressing' && (
              <>
                <div className="download-progress">
                  <div className="progress-bar" style={{ width: `${download.progress}%` }} />
                </div>
                <div className="download-controls">
                  {download.paused ? (
                    <button
                      onClick={() => onResume(download.id)}
                      className="control-btn"
                      disabled={!download.canResume}
                    >
                      Resume
                    </button>
                  ) : (
                    <button onClick={() => onPause(download.id)} className="control-btn">
                      Pause
                    </button>
                  )}
                  <button onClick={() => onCancel(download.id)} className="control-btn danger">
                    Cancel
                  </button>
                </div>
              </>
            )}

            <div className="download-actions">
              {download.state === 'completed' && (
                <>
                  <button onClick={() => onOpenFile(download.path)}>Open</button>
                  <button onClick={() => onShowInFolder(download.path)}>Show in Folder</button>
                </>
              )}

              {/* Remove button (× icon) - always visible for non-progressing downloads */}
              {(download.state === 'completed' ||
                download.state === 'cancelled' ||
                download.state === 'interrupted') && (
                <button
                  onClick={() => onRemove(download.id)}
                  className="icon-btn remove-btn"
                  title="Remove from list"
                  aria-label="Remove from list"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}

              {/* Delete button - only for completed downloads with a file */}
              {download.state === 'completed' && (
                <button
                  onClick={() => {
                    if (confirm(`Delete "${download.fileName}" from your computer?`)) {
                      onDelete(download.id, download.path)
                    }
                  }}
                  className="icon-btn delete-btn danger"
                  title="Delete file"
                  aria-label="Delete file"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

        {downloads.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">⬇️</div>
            <p>No downloads</p>
            <small>Files you download will appear here</small>
          </div>
        )}
      </div>
    </div>
  )
}
