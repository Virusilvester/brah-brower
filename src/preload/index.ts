import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export interface WindowControlsAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
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

export type PermissionValue = 'allow' | 'block' | 'ask'

export interface SitePermissions {
  notifications: PermissionValue
  camera: PermissionValue
  microphone: PermissionValue
  geolocation: PermissionValue
  popups: PermissionValue
  javascript: PermissionValue
  cookies: PermissionValue
  images: PermissionValue
  adblock: PermissionValue
}

export interface SiteSettings {
  origin: string
  permissions: Partial<SitePermissions>
  lastVisited?: number
  title?: string
  favicon?: string
}

export interface SiteSettingsAPI {
  get: (origin: string) => Promise<SiteSettings>
  setPermission: (
    origin: string,
    permission: keyof SitePermissions,
    value: PermissionValue
  ) => Promise<{ success: boolean }>
  reset: (origin: string) => Promise<{ success: boolean }>
  getAll: () => Promise<SiteSettings[]>
  getDefaults: () => Promise<SitePermissions>
}

export interface AdBlockAPI {
  isEnabled: () => Promise<boolean>
  setEnabled: (value: boolean) => Promise<void>
  getBlockedCount: () => Promise<number>
  resetStats: () => Promise<void>
  onBlockedCountChange: (callback: (count: number) => void) => () => void
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

// ── Window Controls ──────────────────────────────────────────────
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

// ── Downloads ────────────────────────────────────────────────────
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
  clearAll: () => ipcRenderer.invoke('downloads:clear-all'),
  remove: (id: string) => ipcRenderer.invoke('downloads:remove', id),
  delete: (id: string, filePath: string) => ipcRenderer.invoke('downloads:delete', id, filePath),
  openFile: (filePath: string) => ipcRenderer.invoke('download:open', filePath),
  showInFolder: (filePath: string) => ipcRenderer.invoke('download:show-in-folder', filePath),
  pause: (id: string) => ipcRenderer.invoke('download:pause', id),
  resume: (id: string) => ipcRenderer.invoke('download:resume', id),
  cancel: (id: string) => ipcRenderer.invoke('download:cancel', id)
} as DownloadsAPI)

// ── Storage ──────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('storage', {
  get: <T>(key: string) => ipcRenderer.invoke('storage:get', key) as Promise<T | null>,
  set: <T>(key: string, value: T) => ipcRenderer.invoke('storage:set', key, value)
} as StorageAPI)

// ── Settings ─────────────────────────────────────────────────────
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

// ── Privacy ──────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('privacy', {
  clearData: (options: ClearDataOptions) => ipcRenderer.invoke('privacy:clear-data', options)
} as PrivacyAPI)

// ── Site Settings ─────────────────────────────────────────────────
contextBridge.exposeInMainWorld('siteSettings', {
  get: (origin: string) => ipcRenderer.invoke('site-settings:get', origin),
  setPermission: (origin: string, permission: string, value: PermissionValue) =>
    ipcRenderer.invoke('site-settings:set-permission', origin, permission, value),
  reset: (origin: string) => ipcRenderer.invoke('site-settings:reset', origin),
  getAll: () => ipcRenderer.invoke('site-settings:get-all'),
  getDefaults: () => ipcRenderer.invoke('site-settings:get-defaults')
} as SiteSettingsAPI)

// ── Ad Block ─────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('adBlock', {
  isEnabled: () => ipcRenderer.invoke('adblock:is-enabled'),
  setEnabled: (value: boolean) => ipcRenderer.invoke('adblock:set-enabled', value),
  getBlockedCount: () => ipcRenderer.invoke('adblock:get-count'),
  resetStats: () => ipcRenderer.invoke('adblock:reset-stats'),
  onBlockedCountChange: (callback: (count: number) => void) => {
    const handler = (_event: IpcRendererEvent, count: number): void => callback(count)
    ipcRenderer.on('adblock:count-updated', handler)
    return () => ipcRenderer.removeListener('adblock:count-updated', handler)
  }
} as AdBlockAPI)

// ── Browser Events ────────────────────────────────────────────────
contextBridge.exposeInMainWorld('browserEvents', {
  onWebviewNewTab: (callback: (url: string) => void) => {
    const handler = (_event: IpcRendererEvent, url: string): void => callback(url)
    ipcRenderer.on('webview-new-tab', handler)
    return () => ipcRenderer.removeListener('webview-new-tab', handler)
  },
  onNewTab: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('browser:new-tab', handler)
    return () => ipcRenderer.removeListener('browser:new-tab', handler)
  }
} as BrowserEventsAPI)

// Dispatch custom event for webview-new-tab
ipcRenderer.on('webview-new-tab', (_event: IpcRendererEvent, url: string) => {
  window.dispatchEvent(new CustomEvent('webview-new-tab', { detail: url }))
})
