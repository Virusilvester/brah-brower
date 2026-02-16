import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  close: () => ipcRenderer.send('close')
})

contextBridge.exposeInMainWorld('downloads', {
  onProgress: (callback: any) => ipcRenderer.on('download-progress', (_, data) => callback(data)),

  onComplete: (callback: any) => ipcRenderer.on('download-complete', (_, data) => callback(data))
})
