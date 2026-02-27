import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export interface WindowControlsAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
}

export interface ContextMenuParams {
  x: number
  y: number
  linkURL?: string
  linkText?: string
  srcURL?: string
  hasImageContents: boolean
  isEditable: boolean
  selectionText: string
  editFlags: {
    canCut: boolean
    canCopy: boolean
    canPaste: boolean
    canSelectAll: boolean
  }
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

// Type definitions
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

export interface DownloadsAPI {
  getAll: () => Promise<DownloadItem[]>
  onStarted: (callback: (data: DownloadItem) => void) => () => void
  onProgress: (callback: (data: DownloadItem) => void) => () => void
  onCompleted: (callback: (data: DownloadItem) => void) => () => void
  clearCompleted: () => Promise<DownloadItem[]>
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
}

// Window controls API
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, value: boolean): void => callback(value)
    ipcRenderer.on('window:maximized', handler)
    return () => ipcRenderer.removeListener('window:maximized', handler)
  }
} as WindowControlsAPI)

// Downloads API
contextBridge.exposeInMainWorld('downloads', {
  getAll: () => ipcRenderer.invoke('downloads:get-all'),
  onStarted: (callback: (data: DownloadItem) => void) => {
    const handler = (_event: IpcRendererEvent, data: DownloadItem): void => callback(data)
    ipcRenderer.on('download:started', handler)
    return () => ipcRenderer.removeListener('download:started', handler)
  },
  onProgress: (callback: (data: DownloadItem) => void) => {
    const handler = (_event: IpcRendererEvent, data: DownloadItem): void => callback(data)
    ipcRenderer.on('download:progress', handler)
    return () => ipcRenderer.removeListener('download:progress', handler)
  },
  onCompleted: (callback: (data: DownloadItem) => void) => {
    const handler = (_event: IpcRendererEvent, data: DownloadItem): void => callback(data)
    ipcRenderer.on('download:completed', handler)
    return () => ipcRenderer.removeListener('download:completed', handler)
  },
  clearCompleted: () => ipcRenderer.invoke('downloads:clear-completed'),
  remove: (id: string) => ipcRenderer.invoke('downloads:remove', id),
  delete: (id: string, filePath: string) => ipcRenderer.invoke('downloads:delete', id, filePath),
  openFile: (filePath: string) => ipcRenderer.invoke('download:open', filePath),
  showInFolder: (filePath: string) => ipcRenderer.invoke('download:show-in-folder', filePath),
  pause: (id: string) => ipcRenderer.invoke('download:pause', id),
  resume: (id: string) => ipcRenderer.invoke('download:resume', id),
  cancel: (id: string) => ipcRenderer.invoke('download:cancel', id)
} as DownloadsAPI)

// Storage API
contextBridge.exposeInMainWorld('storage', {
  get: <T>(key: string) => ipcRenderer.invoke('storage:get', key) as Promise<T | null>,
  set: <T>(key: string, value: T) => ipcRenderer.invoke('storage:set', key, value)
} as StorageAPI)

// NEW: Settings API
contextBridge.exposeInMainWorld('settings', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (newSettings: Partial<AppSettings>) => ipcRenderer.invoke('settings:set', newSettings),
  reset: () => ipcRenderer.invoke('settings:reset'),
  onChange: (callback: (settings: AppSettings) => void) => {
    const handler = (_event: IpcRendererEvent, settings: AppSettings): void => callback(settings)
    ipcRenderer.on('settings:changed', handler)
    return () => ipcRenderer.removeListener('settings:changed', handler)
  }
} as SettingsAPI)

// Browser events API
contextBridge.exposeInMainWorld('browserEvents', {
  onWebviewNewTab: (callback: (url: string) => void) => {
    const handler = (_event: IpcRendererEvent, url: string): void => callback(url)
    ipcRenderer.on('webview-new-tab', handler)
    return () => ipcRenderer.removeListener('webview-new-tab', handler)
  }
} as BrowserEventsAPI)

// Webview API for navigation controls
contextBridge.exposeInMainWorld('webviewControls', {
  // These will be called from renderer to control webview
  executeJavaScript: (_webviewId: string, _code: string) => {
    // This is handled in renderer via ref
  }
})

// Dispatch custom event for webview-new-tab (for backwards compatibility)
ipcRenderer.on('webview-new-tab', (_event: IpcRendererEvent, url: string) => {
  window.dispatchEvent(new CustomEvent('webview-new-tab', { detail: url }))
})
