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
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const activeCount = downloads.filter((d) => d.state === 'progressing').length
  const completedCount = downloads.filter((d) => d.state === 'completed').length

  const getFileExtension = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toUpperCase() || ''
    return ext.slice(0, 4)
  }

  const getExtColor = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (['pdf'].includes(ext)) return '#e05252'
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return '#e8a020'
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return '#7c6ee6'
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) return '#52c97e'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '#52a9e0'
    if (['exe', 'dmg', 'pkg', 'deb'].includes(ext)) return '#e05252'
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return '#3d7ae0'
    return '#8a8790'
  }

  return (
    <div className="panel downloads-panel">
      <div className="panel-header">
        <h3>Downloads{activeCount > 0 ? ` · ${activeCount} active` : ''}</h3>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="panel-actions">
        {completedCount > 0 && (
          <button onClick={onClearCompleted} className="clear-btn">
            Clear Completed ({completedCount})
          </button>
        )}
      </div>

      <div className="panel-content">
        {downloads.map((download) => (
          <div key={download.id} className="download-item">
            <div className="download-header">
              <div
                className="download-ext-badge"
                style={{
                  background: getExtColor(download.fileName) + '22',
                  color: getExtColor(download.fileName)
                }}
              >
                {getFileExtension(download.fileName) || 'FILE'}
              </div>
              <div className="download-filename-wrap">
                <div className="download-filename" title={download.fileName}>
                  {download.fileName}
                </div>
                <div className="download-meta">
                  {download.state === 'progressing' && (
                    <span>
                      {formatBytes(download.receivedBytes)}
                      {download.totalBytes > 0 && ` / ${formatBytes(download.totalBytes)}`}
                      {download.progress > 0 && ` · ${download.progress}%`}
                      {download.paused && <span className="paused-badge"> · Paused</span>}
                    </span>
                  )}
                  {download.state === 'completed' && (
                    <span className="completed">✓ {formatBytes(download.totalBytes)}</span>
                  )}
                  {download.state === 'cancelled' && <span className="cancelled">Cancelled</span>}
                  {download.state === 'interrupted' && <span className="error">Failed</span>}
                </div>
              </div>
              <div className="download-item-actions">
                {(download.state === 'completed' ||
                  download.state === 'cancelled' ||
                  download.state === 'interrupted') && (
                  <button
                    className="icon-btn remove-btn"
                    onClick={() => onRemove(download.id)}
                    title="Remove from list"
                    aria-label="Remove"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {download.state === 'progressing' && (
              <div className="download-progress">
                <div
                  className="progress-bar"
                  style={{
                    width: download.totalBytes > 0 ? `${download.progress}%` : '100%',
                    opacity: download.paused ? 0.5 : 1
                  }}
                />
              </div>
            )}

            <div className="download-actions">
              {download.state === 'progressing' && (
                <>
                  {download.paused ? (
                    <button
                      onClick={() => onResume(download.id)}
                      className="control-btn"
                      disabled={!download.canResume}
                    >
                      ▶ Resume
                    </button>
                  ) : (
                    <button onClick={() => onPause(download.id)} className="control-btn">
                      ⏸ Pause
                    </button>
                  )}
                  <button onClick={() => onCancel(download.id)} className="control-btn danger">
                    Cancel
                  </button>
                </>
              )}

              {download.state === 'completed' && (
                <>
                  <button onClick={() => onOpenFile(download.path)}>Open</button>
                  <button onClick={() => onShowInFolder(download.path)}>Show in Folder</button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${download.fileName}" from your computer?`))
                        onDelete(download.id, download.path)
                    }}
                    className="icon-btn delete-btn danger"
                    title="Delete file"
                    aria-label="Delete file"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </>
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
