import type { DownloadItem } from '../../preload/index.d'
import '../styles/Panel.css'

interface DownloadsPanelProps {
  downloads: DownloadItem[]
  onOpenFile: (path: string) => void
  onShowInFolder: (path: string) => void
  onClearCompleted: () => void
  onClose: () => void
}

export function DownloadsPanel({
  downloads,
  onOpenFile,
  onShowInFolder,
  onClearCompleted,
  onClose
}: DownloadsPanelProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="panel downloads-panel">
      <div className="panel-header">
        <h3>Downloads</h3>
        <button className="close-btn" onClick={onClose}>
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
              <div className="download-filename">{download.fileName}</div>
              <div className="download-meta">
                {download.state === 'progressing' && (
                  <span>
                    {formatBytes(download.receivedBytes)} / {formatBytes(download.totalBytes)}
                  </span>
                )}
                {download.state === 'completed' && <span className="completed">Completed</span>}
                {download.state === 'cancelled' && <span className="cancelled">Cancelled</span>}
                {download.state === 'interrupted' && <span className="error">Failed</span>}
              </div>
            </div>

            {download.state === 'progressing' && (
              <div className="download-progress">
                <div className="progress-bar" style={{ width: `${download.progress}%` }} />
              </div>
            )}

            <div className="download-actions">
              {download.state === 'completed' && (
                <>
                  <button onClick={() => onOpenFile(download.path)}>Open</button>
                  <button onClick={() => onShowInFolder(download.path)}>Show in Folder</button>
                </>
              )}
            </div>
          </div>
        ))}

        {downloads.length === 0 && <div className="empty-state">No downloads</div>}
      </div>
    </div>
  )
}
