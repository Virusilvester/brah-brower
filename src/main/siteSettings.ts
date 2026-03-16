import { app, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'

// ─── Types ─────────────────────────────────────────────────────────
export type PermissionValue = 'allow' | 'block' | 'ask'

export interface SitePermissions {
  notifications: PermissionValue
  camera: PermissionValue
  microphone: PermissionValue
  geolocation: PermissionValue
  popups: PermissionValue
  javascript: PermissionValue
  cookies: PermissionValue
  images: PermissionValue
  adblock: PermissionValue // per-site adblock override
}

export interface SiteSettings {
  origin: string
  permissions: Partial<SitePermissions>
  lastVisited?: number
  title?: string
  favicon?: string
}

const DEFAULT_PERMISSIONS: SitePermissions = {
  notifications: 'ask',
  camera: 'ask',
  microphone: 'ask',
  geolocation: 'ask',
  popups: 'block',
  javascript: 'allow',
  cookies: 'allow',
  images: 'allow',
  adblock: 'ask' // 'ask' means use global setting
}

// ─── Manager ───────────────────────────────────────────────────────
export class SiteSettingsManager {
  private settings: Map<string, SiteSettings> = new Map()
  private filePath: string
  private ipcRegistered = false

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'site-settings.json')
    this.load()
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8')
      const arr: SiteSettings[] = JSON.parse(raw)
      for (const s of arr) {
        if (s.origin) this.settings.set(s.origin, s)
      }
    } catch {
      /* empty */
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(Array.from(this.settings.values()), null, 2))
    } catch {
      /* empty */
    }
  }

  normalizeOrigin(url: string): string {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`)
      return u.origin // e.g. "https://example.com"
    } catch {
      return url
    }
  }

  getSiteSettings(origin: string): SiteSettings {
    const existing = this.settings.get(origin)
    return {
      origin,
      permissions: { ...(existing?.permissions || {}) },
      lastVisited: existing?.lastVisited,
      title: existing?.title,
      favicon: existing?.favicon
    }
  }

  getPermission(origin: string, permission: keyof SitePermissions): PermissionValue {
    const site = this.settings.get(origin)
    if (site?.permissions[permission] !== undefined) {
      return site.permissions[permission]!
    }
    return DEFAULT_PERMISSIONS[permission]
  }

  setPermission(origin: string, permission: keyof SitePermissions, value: PermissionValue): void {
    const existing = this.settings.get(origin) || { origin, permissions: {} }
    existing.permissions[permission] = value
    this.settings.set(origin, existing)
    this.save()
  }

  updateSiteMeta(origin: string, meta: { title?: string; favicon?: string }): void {
    const existing = this.settings.get(origin) || { origin, permissions: {} }
    if (meta.title) existing.title = meta.title
    if (meta.favicon) existing.favicon = meta.favicon
    existing.lastVisited = Date.now()
    this.settings.set(origin, existing)
    this.save()
  }

  resetSite(origin: string): void {
    this.settings.delete(origin)
    this.save()
  }

  getAllSites(): SiteSettings[] {
    return Array.from(this.settings.values()).sort(
      (a, b) => (b.lastVisited || 0) - (a.lastVisited || 0)
    )
  }

  getDefaultPermissions(): SitePermissions {
    return { ...DEFAULT_PERMISSIONS }
  }

  // Register Electron permission request handler
  setupPermissionHandlers(sess: Electron.Session): void {
    sess.setPermissionRequestHandler((webContents, permission, callback) => {
      const url = webContents.getURL()
      const origin = this.normalizeOrigin(url)

      const permMap: Partial<Record<string, keyof SitePermissions>> = {
        notifications: 'notifications',
        media: 'camera', // approximation - electron uses 'media' for camera/mic
        geolocation: 'geolocation',
        openExternal: 'popups'
      }

      const settingKey = permMap[permission]
      if (!settingKey) {
        callback(true) // allow unknown permissions
        return
      }

      const value = this.getPermission(origin, settingKey)

      if (value === 'allow') {
        callback(true)
        return
      }
      if (value === 'block') {
        callback(false)
        return
      }

      // 'ask' - for now grant (a real browser would show a prompt)
      callback(true)
    })
  }

  // ── IPC Handlers ───────────────────────────────────────────────
  setupIPC(): void {
    if (this.ipcRegistered) return
    this.ipcRegistered = true

    ipcMain.handle('site-settings:get', (_e, origin: string) => {
      return this.getSiteSettings(origin)
    })

    ipcMain.handle(
      'site-settings:set-permission',
      (_e, origin: string, permission: string, value: PermissionValue) => {
        this.setPermission(origin, permission as keyof SitePermissions, value)
        return { success: true }
      }
    )

    ipcMain.handle('site-settings:reset', (_e, origin: string) => {
      this.resetSite(origin)
      return { success: true }
    })

    ipcMain.handle('site-settings:get-all', () => {
      return this.getAllSites()
    })

    ipcMain.handle('site-settings:get-defaults', () => {
      return this.getDefaultPermissions()
    })
  }
}

export const siteSettingsManager = new SiteSettingsManager()
