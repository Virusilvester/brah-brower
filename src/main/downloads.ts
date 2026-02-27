import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import fs from 'fs'
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

export interface DownloadPersistenceAdapter {
  getAll: () => DownloadItemData[]
  setAll: (downloads: DownloadItemData[]) => void
  getDefaultDirectory?: () => string | undefined
}

// Use a more robust session identifier
const sessionRegistry = new WeakSet<Electron.Session>()
const sessionKeyRegistry = new Set<string>()

function hasDownloadHandler(session: Electron.Session): boolean {
  if (sessionRegistry.has(session)) return true
  const key = getSessionKey(session)
  return key ? sessionKeyRegistry.has(key) : false
}

function markSessionAsHandled(session: Electron.Session): void {
  sessionRegistry.add(session)
  const key = getSessionKey(session)
  if (key) sessionKeyRegistry.add(key)
}

function getSessionKey(session: Electron.Session): string | null {
  try {
    const key = (session as unknown as { getPartition?: () => string }).getPartition?.()
    return key && typeof key === 'string' ? key : null
  } catch {
    return null
  }
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

export function createDownloadManager(persistence?: DownloadPersistenceAdapter): DownloadManager {
  const activeDownloads = new Map<string, { item: Electron.DownloadItem; data: DownloadItemData }>()
  const handledDownloadItems = new WeakSet<Electron.DownloadItem>()
  // CRITICAL: Use URL-level deduplication that persists through the save dialog
  const pendingSaveDialogsByUrl = new Map<string, number>()
  const recentDownloadsBySource = new Map<string, number>()
  const activeDownloadUrls = new Set<string>()
  const persistThrottle = new Map<string, { lastAt: number; lastProgress: number }>()
  let downloadIpcHandlersRegistered = false

  const getPersistedDownloads = (): DownloadItemData[] => {
    try {
      return persistence?.getAll() ?? []
    } catch {
      return []
    }
  }

  const setPersistedDownloads = (downloads: DownloadItemData[]): void => {
    try {
      persistence?.setAll(downloads)
    } catch (err) {
      console.error('Failed to persist downloads:', err)
    }
  }

  const upsertPersistedDownload = (data: DownloadItemData): void => {
    const existing = getPersistedDownloads()
    const idx = existing.findIndex((d) => d.id === data.id)
    const next = [...existing]
    if (idx >= 0) {
      next[idx] = data
    } else {
      next.unshift(data)
    }
    setPersistedDownloads(next)
  }

  const removePersistedDownload = (id: string): void => {
    const existing = getPersistedDownloads()
    setPersistedDownloads(existing.filter((d) => d.id !== id))
  }

  const clearCompletedPersistedDownloads = (): DownloadItemData[] => {
    const existing = getPersistedDownloads()
    const next = existing.filter((d) => d.state === 'progressing')
    setPersistedDownloads(next)
    return next
  }

  const getDefaultDownloadDirectory = (): string => {
    const fromSettings = persistence?.getDefaultDirectory?.()
    if (fromSettings && typeof fromSettings === 'string' && path.isAbsolute(fromSettings)) {
      return fromSettings
    }
    return app.getPath('downloads')
  }

  const ensureDownloadHandlingForSession = (sessionToHandle: Electron.Session): void => {
    if (hasDownloadHandler(sessionToHandle)) {
      return
    }

    markSessionAsHandled(sessionToHandle)
    console.log(`Setting up download handler for new session`)

    sessionToHandle.on('will-download', async (_event, item, webContents) => {
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

      const fileName = item.getFilename()
      const url = item.getURL()

      // DEDUPLICATION FIX: Check for pending dialogs BEFORE any async operations
      const now = Date.now()

      // Check 1: Is this URL already being processed in a save dialog?
      const pendingAt = pendingSaveDialogsByUrl.get(url)
      if (pendingAt && now - pendingAt < 60_000) {
        console.log(`Save dialog already pending for ${url}, cancelling duplicate download item`)
        item.cancel()
        return
      }

      // Check 2: Was this URL recently downloaded (within last 15 seconds)?
      const lastAt = recentDownloadsBySource.get(url)
      if (lastAt && now - lastAt < 15_000) {
        console.log(`Suppressing duplicate download prompt: ${fileName} from ${url}`)
        item.cancel()
        return
      }

      // Check 3: Is this URL currently downloading?
      if (activeDownloadUrls.has(url)) {
        console.log(`Download already active for ${url}, cancelling duplicate download item`)
        item.cancel()
        return
      }

      // Mark URL as being processed BEFORE showing dialog (prevents race conditions)
      pendingSaveDialogsByUrl.set(url, now)
      recentDownloadsBySource.set(url, now)

      // Cleanup old entries periodically
      for (const [key, ts] of recentDownloadsBySource.entries()) {
        if (now - ts > 30_000) recentDownloadsBySource.delete(key)
      }
      for (const [key, ts] of pendingSaveDialogsByUrl.entries()) {
        if (now - ts > 120_000) pendingSaveDialogsByUrl.delete(key)
      }

      console.log(`Starting download: ${fileName} from ${url}`)

      // Pause immediately so the file doesn't start writing to a temp/default location
      // while the user chooses a save destination.
      try {
        item.pause()
      } catch (err) {
        console.warn('Failed to pause download item before save dialog:', err)
      }

      // Show save dialog
      let filePath: string | undefined
      let canceled = false
      try {
        const result = await dialog.showSaveDialog(ownerWindow, {
          defaultPath: path.join(getDefaultDownloadDirectory(), fileName),
          buttonLabel: 'Save',
          title: 'Save Download',
          properties: ['createDirectory', 'showOverwriteConfirmation']
        })
        filePath = result.filePath ?? undefined
        canceled = result.canceled
      } catch (err) {
        console.error('Save dialog error:', err)
        canceled = true
      } finally {
        // ALWAYS clean up pending dialog tracking
        pendingSaveDialogsByUrl.delete(url)
      }

      if (canceled || !filePath) {
        console.log('Download cancelled by user')
        item.cancel()
        return
      }

      item.setSavePath(filePath)
      try {
        if (item.isPaused()) item.resume()
      } catch (err) {
        console.warn('Failed to resume download item after save dialog:', err)
      }

      const id = crypto.randomUUID()
      const initialDownloadData: DownloadItemData = {
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

      let currentData = initialDownloadData
      activeDownloads.set(id, { item, data: initialDownloadData })
      activeDownloadUrls.add(url)
      upsertPersistedDownload(initialDownloadData)

      // Notify renderer
      if (!ownerWindow.isDestroyed()) {
        ownerWindow.webContents.send('download:started', initialDownloadData)
      }

      // Handle updates
      item.on('updated', (_event, state) => {
        const updateNow = Date.now()
        const received = item.getReceivedBytes()
        const total = item.getTotalBytes()
        const progress = total > 0 ? Math.round((received / total) * 100) : 0

        const updated: DownloadItemData = {
          ...currentData,
          receivedBytes: received,
          totalBytes: total,
          progress,
          state: state === 'progressing' ? 'progressing' : 'interrupted',
          canResume: item.canResume(),
          paused: item.isPaused()
        }

        currentData = updated
        activeDownloads.set(id, { item, data: updated })
        if (!ownerWindow.isDestroyed()) {
          ownerWindow.webContents.send('download:progress', updated)
        }

        const last = persistThrottle.get(id)
        const shouldPersist =
          !last || updateNow - last.lastAt >= 1000 || Math.abs(progress - last.lastProgress) >= 5
        if (shouldPersist) {
          persistThrottle.set(id, { lastAt: updateNow, lastProgress: progress })
          upsertPersistedDownload(updated)
        }
      })

      // Handle completion
      item.once('done', (_event, state) => {
        console.log(`Download ${id} finished with state: ${state}`)

        const final: DownloadItemData = {
          ...currentData,
          state: state as DownloadItemData['state'],
          progress: state === 'completed' ? 100 : currentData.progress,
          canResume: false,
          paused: false
        }

        activeDownloads.delete(id)
        persistThrottle.delete(id)
        activeDownloadUrls.delete(url)
        upsertPersistedDownload(final)
        if (!ownerWindow.isDestroyed()) {
          ownerWindow.webContents.send('download:completed', final)
        }
      })
    })
  }

  const setupDownloadIPCHandlers = (): void => {
    if (downloadIpcHandlersRegistered) return
    downloadIpcHandlersRegistered = true

    ipcMain.handle('downloads:get-all', () => getPersistedDownloads())

    ipcMain.handle('downloads:clear-completed', () => clearCompletedPersistedDownloads())

    ipcMain.handle('downloads:remove', (_event, id: string) => {
      removePersistedDownload(id)
      return { success: true }
    })

    ipcMain.handle('downloads:delete', async (_event, id: string, filePath: string) => {
      try {
        if (!filePath || typeof filePath !== 'string') {
          return { success: false, error: 'Missing file path' }
        }

        if (!validateFilePath(filePath)) {
          return { success: false, error: 'Invalid path' }
        }

        if (!fs.existsSync(filePath)) {
          // File already gone: still remove from list.
          removePersistedDownload(id)
          return { success: true }
        }

        const stat = fs.lstatSync(filePath)
        if (stat.isDirectory()) {
          return { success: false, error: 'Path is a directory' }
        }

        // Prefer trashing the file (Recycle Bin / Trash) so it's recoverable.
        if (
          typeof (shell as unknown as { trashItem?: (p: string) => Promise<void> }).trashItem ===
          'function'
        ) {
          await (shell as unknown as { trashItem: (p: string) => Promise<void> }).trashItem(
            filePath
          )
        } else {
          fs.unlinkSync(filePath)
        }

        removePersistedDownload(id)
        return { success: true }
      } catch (err) {
        console.error('Failed to delete download:', err)
        return { success: false, error: String(err) }
      }
    })

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
        // Keep the entry until the DownloadItem emits 'done' so renderer receives the final state.
        return { success: true }
      }
      const persisted = getPersistedDownloads()
      if (persisted.some((d) => d.id === id)) {
        removePersistedDownload(id)
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
