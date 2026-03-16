import { ipcMain } from 'electron'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

const CC_SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac'])

// ─── Filter Lists ─────────────────────────────────────────────────
const FILTER_LISTS = [
  {
    name: 'EasyList',
    url: 'https://easylist.to/easylist/easylist.txt',
    file: 'easylist.txt'
  },
  {
    name: 'EasyPrivacy',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    file: 'easyprivacy.txt'
  }
]

// ─── Rule Types ───────────────────────────────────────────────────
// ─── AdBlock Manager ─────────────────────────────────────────────
export class AdBlockManager {
  private blockDomains = new Set<string>()
  private exceptionDomains = new Set<string>()
  private enabled = false
  private blockedCount = 0
  private blockedBySession = new WeakSet<Electron.Session>()
  private cacheDir: string
  private statsListeners: Array<(count: number) => void> = []
  private ipcRegistered = false
  private hostDecisionCache = new Map<string, boolean>()
  private static readonly HOST_CACHE_MAX = 5000

  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'adblock')
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    } catch {}
  }

  // ── Rule Parser ────────────────────────────────────────────────
  private clearCaches(): void {
    this.hostDecisionCache.clear()
  }

  private setCachedHostDecision(host: string, value: boolean): void {
    // Refresh insertion order (simple LRU-ish cache).
    this.hostDecisionCache.delete(host)
    this.hostDecisionCache.set(host, value)
    if (this.hostDecisionCache.size <= AdBlockManager.HOST_CACHE_MAX) return

    const oldest = this.hostDecisionCache.keys().next().value as string | undefined
    if (oldest) this.hostDecisionCache.delete(oldest)
  }

  private getCachedHostDecision(host: string): boolean | undefined {
    const v = this.hostDecisionCache.get(host)
    if (v === undefined) return undefined

    // Refresh insertion order.
    this.hostDecisionCache.delete(host)
    this.hostDecisionCache.set(host, v)
    return v
  }

  private isIpAddress(host: string): boolean {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
  }

  // Cheap-ish eTLD+1 heuristic (good enough for "don't break pages" first-party checks).
  private getSiteKey(host: string): string {
    const h = host.toLowerCase()
    if (this.isIpAddress(h)) return h

    const parts = h.split('.').filter(Boolean)
    if (parts.length <= 2) return h

    const last = parts[parts.length - 1] ?? ''
    const secondLast = parts[parts.length - 2] ?? ''

    if (last.length === 2 && CC_SECOND_LEVEL.has(secondLast) && parts.length >= 3) {
      return parts.slice(-3).join('.')
    }

    return parts.slice(-2).join('.')
  }

  private isFirstParty(reqHost: string, sourceHost: string): boolean {
    if (!reqHost || !sourceHost) return false
    return this.getSiteKey(reqHost) === this.getSiteKey(sourceHost)
  }

  private extractDomainRule(line: string): { domain: string; isException: boolean } | null {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) return null

    const isException = trimmed.startsWith('@@')
    let raw = isException ? trimmed.slice(2) : trimmed

    // Skip cosmetic/element rules (CSS hiding)
    if (raw.includes('##') || raw.includes('#@#') || raw.includes('#?#')) return null

    // Only support fast host rules: "||example.com^" (domain-only, no path)
    const dollarIdx = raw.indexOf('$')
    if (dollarIdx !== -1) {
      const opts = raw.slice(dollarIdx + 1)
      // Domain-scoped rules need proper ABP option parsing; skip for safety.
      if (opts.split(',').some((o) => o.startsWith('domain='))) return null
      // "~third-party" applies only to first-party requests, which we don't block anyway.
      if (opts.split(',').includes('~third-party')) return null
      raw = raw.slice(0, dollarIdx)
    }

    if (!raw.startsWith('||')) return null
    const body = raw.slice(2)

    // Exclude path-specific rules (they require more complex matching).
    if (body.includes('/')) return null

    const match = body.match(/^([a-z0-9.-]+)/i)
    if (!match) return null

    const domain = match[1].toLowerCase()
    if (!domain) return null

    const isIp = this.isIpAddress(domain)
    if (!isIp && !domain.includes('.')) return null

    // Only accept plain host anchors (end or separator marker).
    const remainder = body.slice(match[1].length)
    if (remainder && remainder[0] !== '^') return null

    return { domain, isException }
  }

  private loadDomainsFromText(text: string): number {
    const lines = text.split('\n')
    let added = 0

    for (const line of lines) {
      const rule = this.extractDomainRule(line)
      if (!rule) continue

      const setToUse = rule.isException ? this.exceptionDomains : this.blockDomains
      const before = setToUse.size
      setToUse.add(rule.domain)
      if (setToUse.size !== before) added++
    }

    return added
  }

  // ── Load rules from text ───────────────────────────────────────
  // ── Fetch or load cached list ──────────────────────────────────
  private domainMatches(host: string, set: Set<string>): boolean {
    // Checks host and its parent domains (a.b.c -> a.b.c, b.c, c).
    let cur = host.toLowerCase()
    while (true) {
      if (set.has(cur)) return true
      const dotIdx = cur.indexOf('.')
      if (dotIdx === -1) return false
      cur = cur.slice(dotIdx + 1)
    }
  }

  private async fetchOrLoadList(listDef: (typeof FILTER_LISTS)[0]): Promise<string> {
    const filePath = path.join(this.cacheDir, listDef.file)
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    // Use cache if fresh
    try {
      const stat = fs.statSync(filePath)
      if (Date.now() - stat.mtimeMs < maxAge) {
        return fs.readFileSync(filePath, 'utf8')
      }
    } catch {}

    // Fetch fresh
    return new Promise((resolve) => {
      const fallback = () => {
        try {
          return fs.readFileSync(filePath, 'utf8')
        } catch {
          return ''
        }
      }

      const request = https.get(listDef.url, { timeout: 15000 }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            fs.writeFileSync(filePath, data, 'utf8')
          } catch {}
          resolve(data)
        })
        res.on('error', () => resolve(fallback()))
      })

      request.on('error', () => resolve(fallback()))
      request.on('timeout', () => {
        request.destroy()
        resolve(fallback())
      })
    })
  }

  // ── Initialize ─────────────────────────────────────────────────
  async initialize(): Promise<void> {
    console.log('[AdBlock] Loading filter lists...')
    this.blockDomains.clear()
    this.exceptionDomains.clear()
    this.clearCaches()

    for (const list of FILTER_LISTS) {
      try {
        const text = await this.fetchOrLoadList(list)
        if (text) {
          const added = this.loadDomainsFromText(text)
          console.log(`[AdBlock] ${list.name}: +${added} domains`)
        }
      } catch (err) {
        console.error(`[AdBlock] Failed to load ${list.name}:`, err)
      }
    }
    console.log(
      `[AdBlock] Ready: ${this.blockDomains.size} blocked domains, ${this.exceptionDomains.size} exceptions`
    )
  }

  // ── Check URL ─────────────────────────────────────────────────
  shouldBlock(url: string, sourceUrl?: string): boolean {
    if (!this.enabled) return false
    if (!url) return false

    let reqHost = ''
    try {
      reqHost = new URL(url).hostname.toLowerCase()
    } catch {
      return false
    }

    if (!reqHost) return false

    // Never block first-party requests (heuristic; prevents breaking pages).
    if (sourceUrl) {
      try {
        const srcHost = new URL(sourceUrl).hostname.toLowerCase()
        if (this.isFirstParty(reqHost, srcHost)) return false
      } catch {
        // ignore
      }
    }

    const cached = this.getCachedHostDecision(reqHost)
    if (cached !== undefined) return cached

    // Exceptions first.
    if (this.domainMatches(reqHost, this.exceptionDomains)) {
      this.setCachedHostDecision(reqHost, false)
      return false
    }

    const shouldBlock = this.domainMatches(reqHost, this.blockDomains)
    this.setCachedHostDecision(reqHost, shouldBlock)
    return shouldBlock
  }

  // ── Attach to session ─────────────────────────────────────────
  attachToSession(sess: Electron.Session): void {
    if (this.blockedBySession.has(sess)) return
    this.blockedBySession.add(sess)

    sess.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      if (!this.enabled) {
        callback({ cancel: false })
        return
      }

      try {
        // Don't block top-level navigations; only block subresources.
        if (details.resourceType === 'mainFrame') {
          callback({ cancel: false })
          return
        }

        const url = details.url
        // Never block local/internal
        if (
          url.startsWith('file://') ||
          url.startsWith('data:') ||
          url.startsWith('chrome-extension://') ||
          url.includes('localhost') ||
          url.includes('127.0.0.1')
        ) {
          callback({ cancel: false })
          return
        }

        const shouldBlock = this.shouldBlock(url, details.referrer || '')
        if (shouldBlock) {
          this.blockedCount++
          this.notifyStats()
          callback({ cancel: true })
        } else {
          callback({ cancel: false })
        }
      } catch {
        callback({ cancel: false })
      }
    })
  }

  // ── Detach from session ───────────────────────────────────────
  detachFromSession(sess: Electron.Session): void {
    try {
      sess.webRequest.onBeforeRequest(null)
    } catch {}
  }

  // ── Enable/disable ────────────────────────────────────────────
  setEnabled(value: boolean): void {
    this.enabled = value
    console.log(`[AdBlock] ${value ? 'Enabled' : 'Disabled'}`)
  }

  isEnabled(): boolean {
    return this.enabled
  }

  getBlockedCount(): number {
    return this.blockedCount
  }

  resetStats(): void {
    this.blockedCount = 0
    this.notifyStats()
  }

  onStats(cb: (count: number) => void): () => void {
    this.statsListeners.push(cb)
    return () => {
      this.statsListeners = this.statsListeners.filter((l) => l !== cb)
    }
  }

  private notifyStats(): void {
    for (const cb of this.statsListeners) {
      try {
        cb(this.blockedCount)
      } catch {}
    }
  }

  // ── IPC Setup ───────────────────────────────────────────────────
  setupIPC(): void {
    if (this.ipcRegistered) return
    this.ipcRegistered = true

    ipcMain.handle('adblock:is-enabled', () => this.isEnabled())

    ipcMain.handle('adblock:set-enabled', (_e, value: boolean) => {
      this.setEnabled(value)
      // Persist setting
      try {
        const file = path.join(app.getPath('userData'), 'adblock-enabled.json')
        fs.writeFileSync(file, JSON.stringify({ enabled: value }))
      } catch {}
    })

    ipcMain.handle('adblock:get-count', () => this.getBlockedCount())

    ipcMain.handle('adblock:reset-stats', () => this.resetStats())
  }
}

export const adBlockManager = new AdBlockManager()
