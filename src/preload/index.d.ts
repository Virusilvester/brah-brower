export interface DownloadItem {
  id: string
  fileName: string
  progress: number
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  path: string
  totalBytes: number
  receivedBytes: number
}

export interface WindowControlsAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => void
}

export interface DownloadsAPI {
  onStarted: (callback: (data: DownloadItem) => void) => void
  onProgress: (callback: (data: DownloadItem) => void) => void
  onCompleted: (callback: (data: DownloadItem) => void) => void
  openFile: (filePath: string) => Promise<void>
  showInFolder: (filePath: string) => Promise<void>
}

declare global {
  interface Window {
    windowControls: WindowControlsAPI
    downloads: DownloadsAPI
  }
}

export {}
