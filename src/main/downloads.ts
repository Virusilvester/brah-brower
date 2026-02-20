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
}

function getSessionKey(sessionToHandle: Electron.Session): string {
  const partition = (sessionToHandle as unknown as { getPartition?: () => string }).getPartition?.()
  if (typeof partition === 'string') return partition || 'default'

  const partitionProp = (sessionToHandle as unknown as { partition?: string }).partition
  if (typeof partitionProp === 'string') return partitionProp || 'default'

  return 'default'
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
  const sessionsWithDownloadHandlers = new Set<string>()
  const handledDownloadItems = new WeakSet<Electron.DownloadItem>()
  let downloadIpcHandlersRegistered = false

  const ensureDownloadHandlingForSession = (sessionToHandle: Electron.Session): void => {
    const sessionKey = getSessionKey(sessionToHandle)
    if (sessionsWithDownloadHandlers.has(sessionKey)) return
    sessionsWithDownloadHandlers.add(sessionKey)

    sessionToHandle.on('will-download', async (_event, item, webContents) => {
      // Guard against duplicate handlers causing the same DownloadItem to be processed multiple times.
      if (handledDownloadItems.has(item)) return
      handledDownloadItems.add(item)

      const ownerWindow = getOwningWindowForWebContents(webContents)
      if (!ownerWindow || ownerWindow.isDestroyed()) return

      const id = crypto.randomUUID()
      const fileName = item.getFilename()

      const { filePath } = await dialog.showSaveDialog(ownerWindow, {
        defaultPath: fileName,
        buttonLabel: 'Save',
        title: 'Save Download'
      })

      if (!filePath) {
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
        url: item.getURL(),
        canResume: false,
        paused: false
      }

      activeDownloads.set(id, { item, data: downloadData })
      ownerWindow.webContents.send('download:started', downloadData)

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
        if (!ownerWindow.isDestroyed()) ownerWindow.webContents.send('download:progress', updated)
      })

      item.once('done', (_event, state) => {
        const final: DownloadItemData = {
          ...downloadData,
          state: state as DownloadItemData['state'],
          progress: state === 'completed' ? 100 : downloadData.progress,
          canResume: false,
          paused: false
        }

        activeDownloads.delete(id)
        if (!ownerWindow.isDestroyed()) ownerWindow.webContents.send('download:completed', final)
      })
    })
  }

  const setupDownloadIPCHandlers = (): void => {
    if (downloadIpcHandlersRegistered) return
    downloadIpcHandlersRegistered = true

    ipcMain.handle('download:open', (_event, filePath: string) => {
      if (!validateFilePath(filePath)) return
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
      }
    })

    ipcMain.handle('download:resume', (_event, id: string) => {
      const download = activeDownloads.get(id)
      if (download && download.item.canResume()) {
        download.item.resume()
      }
    })

    ipcMain.handle('download:cancel', (_event, id: string) => {
      const download = activeDownloads.get(id)
      if (download) {
        download.item.cancel()
        activeDownloads.delete(id)
      }
    })
  }

  return {
    ensureDownloadHandlingForSession,
    setupDownloadIPCHandlers
  }
}
