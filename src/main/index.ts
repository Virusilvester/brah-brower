import { app, BrowserWindow, ipcMain, shell, screen, Menu, clipboard } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

import StoreImport from 'electron-store'
import { createDownloadManager, type DownloadItemData } from './downloads'

// electron-store v11+ is ESM; when bundled to CJS (electron-vite), `require('electron-store')`
// can return `{ default: Store }`. Keep a runtime-safe interop here.
const Store = (StoreImport as unknown as { default?: typeof StoreImport }).default ?? StoreImport

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
const store = new Store<WindowState & { downloads: DownloadItemData[] }>({
  name: 'brah-browser-state',
  defaults: {
    width: 1400,
    height: 900,
    x: undefined,
    y: undefined,
    isMaximized: false,
    isFullScreen: false,
    downloads: []
  }
})

const windows = new Set<BrowserWindow>()
const downloadManager = createDownloadManager()

function createWindow(): BrowserWindow {
  const savedState = store.store as WindowState
  const { width, height, x, y, isMaximized } = savedState

  // Ensure window is within screen bounds
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  let validX = x
  let validY = y

  if (validX !== undefined && validY !== undefined) {
    const isOffScreen =
      validX < -50 || validY < -50 || validX > screenWidth - 100 || validY > screenHeight - 100

    if (isOffScreen) {
      validX = Math.round((screenWidth - width) / 2)
      validY = Math.round((screenHeight - height) / 2)
    }
  } else {
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
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      allowRunningInsecureContent: false,
      sandbox: true
    }
  })

  windows.add(mainWindow)

  if (isMaximized && !mainWindow.isMaximized()) {
    mainWindow.maximize()
  }

  // Save window state with debounce
  let saveTimeout: NodeJS.Timeout
  const saveState = (): void => {
    const bounds = mainWindow.getNormalBounds()
    store.set('width', bounds.width)
    store.set('height', bounds.height)
    store.set('x', bounds.x)
    store.set('y', bounds.y)
    store.set('isMaximized', mainWindow.isMaximized())
    store.set('isFullScreen', mainWindow.isFullScreen())
  }

  const debouncedSave = (): void => {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(saveState, 100)
  }

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
  setupStorageAPI()
  setupExternalLinks(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function setupContextMenuForWebContents(
  contents: Electron.WebContents,
  window: BrowserWindow
): void {
  contents.on('context-menu', (_event, params) => {
    const template: Electron.MenuItemConstructorOptions[] = []

    // Link context menu
    if (params.linkURL && params.linkURL !== '') {
      template.push(
        {
          label: 'Open Link in New Tab',
          click: () => {
            window.webContents.send('webview-new-tab', params.linkURL)
          }
        },
        {
          label: 'Open Link in New Window',
          click: () => {
            createPopupWindow(params.linkURL, window)
          }
        },
        { type: 'separator' },
        {
          label: 'Copy Link Address',
          click: () => {
            clipboard.writeText(params.linkURL)
          }
        },
        {
          label: 'Copy Link Text',
          click: () => {
            clipboard.writeText(params.linkText || '')
          }
        }
      )
    }

    // Image context menu
    if (params.hasImageContents && params.srcURL) {
      if (template.length > 0) template.push({ type: 'separator' })

      template.push(
        {
          label: 'Open Image in New Tab',
          click: () => {
            window.webContents.send('webview-new-tab', params.srcURL)
          }
        },
        {
          label: 'Save Image As...',
          click: () => {
            // Trigger download via webview
            contents.downloadURL(params.srcURL)
          }
        },
        {
          label: 'Copy Image',
          click: () => {
            contents.copyImageAt(params.x, params.y)
          }
        },
        {
          label: 'Copy Image Address',
          click: () => {
            clipboard.writeText(params.srcURL)
          }
        }
      )
    }

    // Selected text context menu
    if (params.selectionText && params.selectionText.trim().length > 0) {
      if (template.length > 0) template.push({ type: 'separator' })

      template.push(
        {
          label: `Search Google for "${params.selectionText.substring(0, 25)}${params.selectionText.length > 25 ? '...' : ''}"`,
          click: () => {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(params.selectionText)}`
            window.webContents.send('webview-new-tab', searchUrl)
          }
        },
        { type: 'separator' },
        {
          label: 'Copy',
          click: () => {
            clipboard.writeText(params.selectionText)
          }
        }
      )

      // Only show cut if editable
      if (params.isEditable) {
        template.unshift({
          label: 'Cut',
          click: () => {
            contents.cut()
          }
        })
      }
    }

    // Editable area context menu (inputs, textareas, contenteditable)
    if (params.isEditable) {
      if (template.length > 0 && !params.selectionText) template.push({ type: 'separator' })

      // Add paste if not already added via selection
      if (!params.selectionText) {
        template.push(
          {
            label: 'Cut',
            enabled: params.editFlags.canCut,
            click: () => contents.cut()
          },
          {
            label: 'Copy',
            enabled: params.editFlags.canCopy,
            click: () => contents.copy()
          }
        )
      }

      template.push({
        label: 'Paste',
        enabled: params.editFlags.canPaste,
        click: () => contents.paste()
      })

      if (params.editFlags.canSelectAll) {
        template.push({
          label: 'Select All',
          click: () => contents.selectAll()
        })
      }
    }

    // Page navigation options (when right-clicking on page, not link)
    if (
      !params.linkURL &&
      !params.hasImageContents &&
      !params.isEditable &&
      !params.selectionText
    ) {
      template.push(
        {
          label: 'Back',
          enabled: contents.canGoBack(),
          click: () => contents.goBack()
        },
        {
          label: 'Forward',
          enabled: contents.canGoForward(),
          click: () => contents.goForward()
        },
        {
          label: 'Reload',
          click: () => contents.reload()
        },
        { type: 'separator' },
        {
          label: 'Save Page As...',
          click: () => {
            // This would need a save dialog implementation
            window.webContents.send('save-page-requested')
          }
        },
        {
          label: 'Print...',
          click: () => contents.print()
        }
      )
    }

    // Add separator and inspect element for all contexts
    if (template.length > 0) template.push({ type: 'separator' })

    // Only show inspect in development or if explicitly enabled
    const isDev = !!process.env.VITE_DEV_SERVER_URL
    if (isDev) {
      template.push({
        label: 'Inspect Element',
        click: () => {
          contents.inspectElement(params.x, params.y)
          if (!contents.isDevToolsOpened()) {
            contents.openDevTools()
          }
        }
      })
    }

    // Build and show menu
    if (template.length > 0) {
      const menu = Menu.buildFromTemplate(template)
      menu.popup({
        window: window,
        x: params.x,
        y: params.y,
        frame: params.frame ?? undefined
      })
    }
  })
}

// Helper function to create popup windows
function createPopupWindow(url: string, parentWindow: BrowserWindow): BrowserWindow {
  const popup = new BrowserWindow({
    width: 1024,
    height: 768,
    parent: parentWindow,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  popup.loadURL(url)
  return popup
}

function setupWindowControls(window: BrowserWindow): void {
  // Security: Validate sender in all handlers
  const validateSender = (event: Electron.IpcMainInvokeEvent): boolean => {
    return event.sender === window.webContents
  }

  ipcMain.handle('window:minimize', (event) => {
    if (!validateSender(event)) return
    window.minimize()
  })

  ipcMain.handle('window:maximize', (event) => {
    if (!validateSender(event)) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })

  ipcMain.handle('window:close', (event) => {
    if (!validateSender(event)) return
    window.close()
  })

  ipcMain.handle('window:isMaximized', (event) => {
    if (!validateSender(event)) return false
    return window.isMaximized()
  })

  window.on('maximize', () => window.webContents.send('window:maximized', true))
  window.on('unmaximize', () => window.webContents.send('window:maximized', false))
}

function setupStorageAPI(): void {
  // Implement storage API that was exposed in preload but not handled
  ipcMain.handle('storage:get', (event, key: string) => {
    // Validate sender
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null

    try {
      return store.get(key as any)
    } catch {
      return null
    }
  })

  ipcMain.handle('storage:set', (event, key: string, value: any) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    try {
      store.set(key as any, value)
    } catch (err) {
      console.error('Storage set error:', err)
    }
  })
}

function setupExternalLinks(window: BrowserWindow): void {
  // Add context menu for main window webContents
  setupContextMenuForWebContents(window.webContents, window)
  window.webContents.setWindowOpenHandler(({ url, disposition }) => {
    if (disposition === 'new-window' || disposition === 'foreground-tab') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1024,
          height: 768,
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
  downloadManager.setupDownloadIPCHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('web-contents-created', (_event, contents) => {
  downloadManager.ensureDownloadHandlingForSession(contents.session)

  if (contents.getType() === 'webview') {
    // Get the host window for this webview
    const hostWebContents = contents.hostWebContents
    const window = hostWebContents ? BrowserWindow.fromWebContents(hostWebContents) : null

    if (window) {
      setupContextMenuForWebContents(contents, window)
    }

    contents.setWindowOpenHandler(({ url, disposition, frameName }) => {
      // Prevent popups/new windows from the webview; renderer handles tab creation via the
      // <webview> 'new-window' event and our explicit context-menu actions.
      void url
      void disposition
      void frameName
      return { action: 'deny' }
    })
  }
})
