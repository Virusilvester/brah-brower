import { BrowserWindow, ipcMain, shell, dialog } from 'electron'
import path from 'path'
import crypto from 'crypto'

export interface DownloadItemData {
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

// Use a more robust session identifier
const sessionRegistry = new WeakSet<Electron.Session>()

function hasDownloadHandler(session: Electron.Session): boolean {
  return sessionRegistry.has(session)
}

function markSessionAsHandled(session: Electron.Session): void {
  sessionRegistry.add(session)
}

function getOwningWindowForWebContents(contents: Electron.WebContents): BrowserWindow | null {
  const direct = BrowserWindow.fromWebContents(contents)
  if (direct) return direct

  const hostWebContents = (contents as unknown as { hostWebContents?: Electron.WebContents })
    .hostWebContents
  if (!hostWebContents) return null

  return BrowserWindow.fromWebContents(hostWebContents)
}

function validateFilePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false
  if (filePath.includes('..')) return false
  if (!path.isAbsolute(filePath)) return false
  return true
}

export interface DownloadManager {
  ensureDownloadHandlingForSession: (sessionToHandle: Electron.Session) => void
  setupDownloadIPCHandlers: () => void
}

export function createDownloadManager(): DownloadManager {
  const activeDownloads = new Map<string, { item: Electron.DownloadItem; data: DownloadItemData }>()
  const handledDownloadItems = new WeakSet<Electron.DownloadItem>()
  let downloadIpcHandlersRegistered = false

  const ensureDownloadHandlingForSession = (sessionToHandle: Electron.Session): void => {
    // Use WeakSet to track handled sessions - more reliable than string keys
    if (hasDownloadHandler(sessionToHandle)) {
      return
    }

    markSessionAsHandled(sessionToHandle)
    console.log(`Setting up download handler for new session`)

    sessionToHandle.on('will-download', async (event, item, webContents) => {
      // Guard against duplicate handlers causing the same DownloadItem to be processed multiple times.
      if (handledDownloadItems.has(item)) {
        console.log('Download item already handled, skipping')
        return
      }
      handledDownloadItems.add(item)

      const ownerWindow = getOwningWindowForWebContents(webContents)
      if (!ownerWindow || ownerWindow.isDestroyed()) {
        console.log('No valid owner window for download')
        item.cancel()
        return
      }

      const id = crypto.randomUUID()
      const fileName = item.getFilename()
      const url = item.getURL()

      console.log(`Starting download: ${fileName} from ${url}`)

      // Show save dialog
      const { filePath, canceled } = await dialog.showSaveDialog(ownerWindow, {
        defaultPath: fileName,
        buttonLabel: 'Save',
        title: 'Save Download',
        properties: ['createDirectory', 'showOverwriteConfirmation']
      })

      if (canceled || !filePath) {
        console.log('Download cancelled by user')
        item.cancel()
        return
      }

      item.setSavePath(filePath)

      const downloadData: DownloadItemData = {
        id,
        fileName: path.basename(filePath),
        progress: 0,
        state: 'progressing',
        path: filePath,
        totalBytes: item.getTotalBytes(),
        receivedBytes: 0,
        url: url,
        canResume: false,
        paused: false,
        startTime: Date.now()
      }

      activeDownloads.set(id, { item, data: downloadData })

      // Notify renderer
      if (!ownerWindow.isDestroyed()) {
        ownerWindow.webContents.send('download:started', downloadData)
      }

      // Handle updates
      item.on('updated', (_event, state) => {
        const received = item.getReceivedBytes()
        const total = item.getTotalBytes()
        const progress = total > 0 ? Math.round((received / total) * 100) : 0

        const updated: DownloadItemData = {
          ...downloadData,
          receivedBytes: received,
          totalBytes: total,
          progress,
          state: state === 'progressing' ? 'progressing' : 'interrupted',
          canResume: item.canResume(),
          paused: item.isPaused()
        }

        activeDownloads.set(id, { item, data: updated })
        if (!ownerWindow.isDestroyed()) {
          ownerWindow.webContents.send('download:progress', updated)
        }
      })

      // Handle completion
      item.once('done', (_event, state) => {
        console.log(`Download ${id} finished with state: ${state}`)

        const final: DownloadItemData = {
          ...downloadData,
          state: state as DownloadItemData['state'],
          progress: state === 'completed' ? 100 : downloadData.progress,
          canResume: false,
          paused: false
        }

        activeDownloads.delete(id)
        if (!ownerWindow.isDestroyed()) {
          ownerWindow.webContents.send('download:completed', final)
        }
      })
    })
  }

  const setupDownloadIPCHandlers = (): void => {
    if (downloadIpcHandlersRegistered) return
    downloadIpcHandlersRegistered = true

    ipcMain.handle('download:open', (_event, filePath: string) => {
      if (!validateFilePath(filePath)) return { success: false, error: 'Invalid path' }
      return shell.openPath(filePath)
    })

    ipcMain.handle('download:show-in-folder', (_event, filePath: string) => {
      if (!validateFilePath(filePath)) return
      shell.showItemInFolder(filePath)
    })

    ipcMain.handle('download:pause', (_event, id: string) => {
      const download = activeDownloads.get(id)
      if (download && !download.item.isPaused()) {
        download.item.pause()
        return { success: true }
      }
      return { success: false, error: 'Download not found or already paused' }
    })

    ipcMain.handle('download:resume', (_event, id: string) => {
      const download = activeDownloads.get(id)
      if (download && download.item.canResume()) {
        download.item.resume()
        return { success: true }
      }
      return { success: false, error: 'Download not found or cannot resume' }
    })

    ipcMain.handle('download:cancel', (_event, id: string) => {
      const download = activeDownloads.get(id)
      if (download) {
        download.item.cancel()
        activeDownloads.delete(id)
        return { success: true }
      }
      return { success: false, error: 'Download not found' }
    })
  }

  return {
    ensureDownloadHandlingForSession,
    setupDownloadIPCHandlers
  }
}
