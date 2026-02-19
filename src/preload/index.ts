import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Window controls API
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_event: IpcRendererEvent, value: boolean) =>
      callback(value)
    )
  }
})

// Downloads API
contextBridge.exposeInMainWorld('downloads', {
  onStarted: (callback: (data: any) => void) => {
    ipcRenderer.on('download:started', (_event, data) => callback(data))
  },
  onProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('download:progress', (_event, data) => callback(data))
  },
  onCompleted: (callback: (data: any) => void) => {
    ipcRenderer.on('download:completed', (_event, data) => callback(data))
  },
  openFile: (filePath: string) => ipcRenderer.invoke('download:open', filePath),
  showInFolder: (filePath: string) => ipcRenderer.invoke('download:show-in-folder', filePath)
})

// Storage API for persistent data
contextBridge.exposeInMainWorld('storage', {
  get: (key: string) => {
    return ipcRenderer.invoke('storage:get', key)
  },
  set: (key: string, value: any) => {
    ipcRenderer.invoke('storage:set', key, value)
  }
})

// Remove all listeners when needed
contextBridge.exposeInMainWorld('removeAllListeners', (channel: string) => {
  ipcRenderer.removeAllListeners(channel)
})
