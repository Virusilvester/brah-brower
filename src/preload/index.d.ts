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
  startTime?: number
}

export interface AppSettings {
  theme: 'dark' | 'light'
  searchEngine: string
  homepage: string
  downloadPath?: string
  enableAdBlock?: boolean
  enableNotifications?: boolean
  spellcheck?: boolean
}

export interface WindowControlsAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
}

export interface DownloadsAPI {
  getAll: () => Promise<DownloadItem[]>
  onStarted: (callback: (data: DownloadItem) => void) => () => void
  onProgress: (callback: (data: DownloadItem) => void) => () => void
  onCompleted: (callback: (data: DownloadItem) => void) => () => void
  clearCompleted: () => Promise<DownloadItem[]>
  clearAll: () => Promise<DownloadItem[]>
  remove: (id: string) => Promise<{ success: boolean; error?: string }>
  delete: (id: string, filePath: string) => Promise<{ success: boolean; error?: string }>
  openFile: (filePath: string) => Promise<void>
  showInFolder: (filePath: string) => Promise<void>
  pause: (id: string) => Promise<{ success: boolean; error?: string }>
  resume: (id: string) => Promise<{ success: boolean; error?: string }>
  cancel: (id: string) => Promise<{ success: boolean; error?: string }>
}

export interface StorageAPI {
  get: <T>(key: string) => Promise<T | null>
  set: <T>(key: string, value: T) => Promise<void>
}

export interface SettingsAPI {
  get: () => Promise<AppSettings | null>
  set: (settings: Partial<AppSettings>) => Promise<AppSettings | null>
  reset: () => Promise<AppSettings | null>
  onChange: (callback: (settings: AppSettings) => void) => () => void
}

export interface BrowserEventsAPI {
  onWebviewNewTab: (callback: (url: string) => void) => () => void
  onNewTab: (callback: () => void) => () => void
}

export interface ClearDataOptions {
  history?: boolean
  downloads?: boolean
  bookmarks?: boolean
  cookies?: boolean
  cache?: boolean
  siteData?: boolean
}

export interface PrivacyAPI {
  clearData: (options: ClearDataOptions) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    windowControls: WindowControlsAPI
    downloads: DownloadsAPI
    storage: StorageAPI
    settings: SettingsAPI
    browserEvents: BrowserEventsAPI
    privacy: PrivacyAPI
  }
}

export {}
