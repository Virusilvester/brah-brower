import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      allowRunningInsecureContent: false
    },
    show: false
  })

  windows.add(mainWindow)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('closed', () => {
    windows.delete(mainWindow)
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
  // Handle window.open from webview
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Handle navigation that tries to leave the site
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault()
      shell.openExternal(url)
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

// Security: Prevent new window creation from webview
app.on('web-contents-created', (_event, contents) => {
  // This handles window.open from webviews
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})
