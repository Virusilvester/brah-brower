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

// Add to global Window interface
declare global {
  interface Window {
    windowControls: WindowControlsAPI
    downloads: DownloadsAPI
    storage: StorageAPI
    // Context menu is handled internally by main process
  }
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

ipcRenderer.on('webview-new-tab', (_event: IpcRendererEvent, url: string) => {
  // Dispatch custom event that renderer can listen to
  window.dispatchEvent(new CustomEvent('webview-new-tab', { detail: url }))
})
