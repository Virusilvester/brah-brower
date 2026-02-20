export interface DownloadItem {
  id: string
  fileName: string
  progress: number
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  path: string
  totalBytes: number
  receivedBytes: number
  url: string
  canResume?: boolean
  paused?: boolean
}

export interface WindowControlsAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
}

export interface DownloadsAPI {
  onStarted: (callback: (data: DownloadItem) => void) => () => void
  onProgress: (callback: (data: DownloadItem) => void) => () => void
  onCompleted: (callback: (data: DownloadItem) => void) => () => void
  openFile: (filePath: string) => Promise<void>
  showInFolder: (filePath: string) => Promise<void>
  pause: (id: string) => Promise<void>
  resume: (id: string) => Promise<void>
  cancel: (id: string) => Promise<void>
}

export interface StorageAPI {
  get: <T>(key: string) => Promise<T | null>
  set: <T>(key: string, value: T) => Promise<void>
}

export interface BrowserEventsAPI {
  onWebviewNewTab: (callback: (url: string) => void) => () => void
}

declare global {
  interface Window {
    windowControls: WindowControlsAPI
    downloads: DownloadsAPI
    storage: StorageAPI
    browserEvents: BrowserEventsAPI
  }
}

export {}
