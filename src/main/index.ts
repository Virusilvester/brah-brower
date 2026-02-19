import { app, BrowserWindow, ipcMain, session, shell, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

import StoreModule from 'electron-store'
const Store = StoreModule.default || StoreModule

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Window state interface
interface WindowState {
  width: number
  height: number
  x: number | undefined
  y: number | undefined
  isMaximized: boolean
  isFullScreen: boolean
}

// Initialize store with defaults
const store = new Store<WindowState>({
  name: 'window-state',
  defaults: {
    width: 1400,
    height: 900,
    x: undefined,
    y: undefined,
    isMaximized: false,
    isFullScreen: false
  }
})

const windows = new Set<BrowserWindow>()

interface DownloadItem {
  id: string
  fileName: string
  progress: number
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  path: string
  totalBytes: number
  receivedBytes: number
}

const activeDownloads = new Map<string, DownloadItem>()

function createWindow(): BrowserWindow {
  // Get saved state
  const savedState = store.store as WindowState
  let { width, height, x, y, isMaximized } = savedState

  // Ensure window is within screen bounds
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  // Validate position is on screen (with 50px tolerance)
  let validX = x
  let validY = y

  if (validX !== undefined && validY !== undefined) {
    const isOffScreen =
      validX < -50 || // Left edge too far off
      validY < -50 || // Top edge too far off
      validX > screenWidth - 100 || // Too far right (at least 100px should be visible)
      validY > screenHeight - 100 // Too far down (at least 100px should be visible)

    if (isOffScreen) {
      // Center on screen if off-screen
      validX = Math.round((screenWidth - width) / 2)
      validY = Math.round((screenHeight - height) / 2)
    }
  } else {
    // Center if no position saved
    validX = Math.round((screenWidth - width) / 2)
    validY = Math.round((screenHeight - height) / 2)
  }

  const mainWindow = new BrowserWindow({
    width,
    height,
    x: validX,
    y: validY,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    show: false, // Don't show until ready to prevent visual flash
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      allowRunningInsecureContent: false
    }
  })

  windows.add(mainWindow)

  // Restore maximized state (do this before showing)
  if (isMaximized && !mainWindow.isMaximized()) {
    mainWindow.maximize()
  }

  // Save window state on changes (debounced)
  let saveTimeout: NodeJS.Timeout

  const saveState = () => {
    // Get normal bounds (un-maximized size) so we can restore properly
    const bounds = mainWindow.getNormalBounds()
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen()
    }
    store.set(state)
  }

  const debouncedSave = () => {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(saveState, 100)
  }

  // Save on various window events
  mainWindow.on('resize', debouncedSave)
  mainWindow.on('move', debouncedSave)
  mainWindow.on('maximize', saveState)
  mainWindow.on('unmaximize', saveState)
  mainWindow.on('enter-full-screen', saveState)
  mainWindow.on('leave-full-screen', saveState)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('closed', () => {
    windows.delete(mainWindow)
    clearTimeout(saveTimeout)
  })

  setupWindowControls(mainWindow)
  setupDownloadHandling(mainWindow)
  setupExternalLinks(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function setupWindowControls(window: BrowserWindow): void {
  ipcMain.handle('window:minimize', () => window.minimize())
  ipcMain.handle('window:maximize', () => {
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.handle('window:close', () => window.close())
  ipcMain.handle('window:isMaximized', () => window.isMaximized())

  window.on('maximize', () => window.webContents.send('window:maximized', true))
  window.on('unmaximize', () => window.webContents.send('window:maximized', false))
}

function setupDownloadHandling(window: BrowserWindow): void {
  session.defaultSession.on('will-download', (_event, item) => {
    const id = crypto.randomUUID()
    const fileName = item.getFilename()
    const savePath = path.join(app.getPath('downloads'), fileName)

    item.setSavePath(savePath)

    const downloadItem: DownloadItem = {
      id,
      fileName,
      progress: 0,
      state: 'progressing',
      path: savePath,
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0
    }

    activeDownloads.set(id, downloadItem)
    window.webContents.send('download:started', downloadItem)

    item.on('updated', (_event, state) => {
      const received = item.getReceivedBytes()
      const total = item.getTotalBytes()
      const progress = total > 0 ? Math.round((received / total) * 100) : 0
      const updated = {
        ...downloadItem,
        receivedBytes: received,
        totalBytes: total,
        progress,
        state: state === 'progressing' ? 'progressing' : 'interrupted'
      }
      activeDownloads.set(id, updated)
      window.webContents.send('download:progress', updated)
    })

    item.once('done', (_event, state) => {
      const final = {
        ...downloadItem,
        state: state as any,
        progress: state === 'completed' ? 100 : downloadItem.progress
      }
      activeDownloads.set(id, final)
      window.webContents.send('download:completed', final)
      if (state === 'completed') shell.showItemInFolder(savePath)
    })
  })

  ipcMain.handle('download:open', (_event, filePath: string) => shell.openPath(filePath))
  ipcMain.handle('download:show-in-folder', (_event, filePath: string) =>
    shell.showItemInFolder(filePath)
  )
}

function setupExternalLinks(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url, disposition, frameName, features }) => {
    if (disposition === 'new-window' || disposition === 'foreground-tab') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 600,
          frame: true,
          parent: window,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        }
      }
    }

    shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault()
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url, disposition, frameName }) => {
      if (disposition === 'new-window' || frameName === '_blank') {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500,
            height: 600,
            frame: true,
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true
            }
          }
        }
      }

      const mainWindow = BrowserWindow.fromWebContents(contents.hostWebContents)
      if (mainWindow) {
        mainWindow.webContents.send('webview-new-tab', url)
      }
      return { action: 'deny' }
    })
  }
})
