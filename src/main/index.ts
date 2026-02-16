import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'path'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true // 👈 IMPORTANT
    }
  })

  ipcMain.on('minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })

  ipcMain.on('maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return

    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.on('close', () => {
    BrowserWindow.getFocusedWindow()?.close()
  })

  session.defaultSession.on('will-download', (event, item) => {
    const fileName = item.getFilename()

    const savePath = path.join(app.getPath('downloads'), fileName)
    item.setSavePath(savePath)

    const win = BrowserWindow.getFocusedWindow()

    item.on('updated', () => {
      const progress = Math.round((item.getReceivedBytes() / item.getTotalBytes()) * 100)

      win?.webContents.send('download-progress', {
        fileName,
        progress
      })
    })

    item.once('done', (_, state) => {
      win?.webContents.send('download-complete', {
        fileName,
        state,
        path: savePath
      })
    })
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)
