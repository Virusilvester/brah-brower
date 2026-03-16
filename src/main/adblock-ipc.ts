// ─── ADD TO main/index.ts ─────────────────────────────────────────
// Import at top of file:
//   import { adBlockManager } from './adblock'
//   import { siteSettingsManager } from './siteSettings'

// In your app.whenReady() or createWindow():
//   await adBlockManager.initialize()
//   adBlockManager.setupIPC(mainWindow)
//   siteSettingsManager.setupIPC()

// When creating a new BrowserWindow session:
//   adBlockManager.attachToSession(session.defaultSession)
//   siteSettingsManager.setupPermissionHandlers(session.defaultSession)

// Also, when ensureDownloadHandlingForSession creates a new session:
//   adBlockManager.attachToSession(sessionToHandle)
//   siteSettingsManager.setupPermissionHandlers(sessionToHandle)

// ─── IPC Handlers to register ────────────────────────────────────
import { ipcMain, BrowserWindow } from 'electron'
import { adBlockManager } from './adblock'

export function setupAdBlockIPC(mainWindow: BrowserWindow): void {
  // Subscribe stats → push to renderer
  adBlockManager.onStats((count) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('adblock:count-updated', count)
    }
  })

  ipcMain.handle('adblock:is-enabled', () => adBlockManager.isEnabled())

  ipcMain.handle('adblock:set-enabled', (_e, value: boolean) => {
    adBlockManager.setEnabled(value)
    // Persist setting
    try {
      const { app } = require('electron')
      const fs = require('fs')
      const path = require('path')
      const file = path.join(app.getPath('userData'), 'adblock-enabled.json')
      fs.writeFileSync(file, JSON.stringify({ enabled: value }))
    } catch {}
  })

  ipcMain.handle('adblock:get-count', () => adBlockManager.getBlockedCount())

  ipcMain.handle('adblock:reset-stats', () => adBlockManager.resetStats())
}

// ─── Load persisted adblock state on startup ──────────────────────
export function loadAdBlockState(): void {
  try {
    const { app } = require('electron')
    const fs = require('fs')
    const path = require('path')
    const file = path.join(app.getPath('userData'), 'adblock-enabled.json')
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (typeof data.enabled === 'boolean') {
      adBlockManager.setEnabled(data.enabled)
    }
  } catch {
    // Default: disabled
  }
}
