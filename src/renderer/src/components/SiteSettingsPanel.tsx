import { useState, useEffect, useCallback, JSX } from 'react'
import type { SitePermissions, PermissionValue, SiteSettings } from '../../../preload/index.d'
import '../styles/Panel.css'
import '../styles/SiteSettings.css'

interface SiteSettingsPanelProps {
  url: string
  onClose: () => void
}

type PermKey = keyof SitePermissions

interface PermissionDef {
  key: PermKey
  label: string
  description: string
  icon: JSX.Element
  options: PermissionValue[]
}

const PERMISSION_DEFS: PermissionDef[] = [
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Show desktop notifications',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    options: ['allow', 'block', 'ask']
  },
  {
    key: 'camera',
    label: 'Camera',
    description: 'Access your camera',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
    options: ['allow', 'block', 'ask']
  },
  {
    key: 'microphone',
    label: 'Microphone',
    description: 'Access your microphone',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
    options: ['allow', 'block', 'ask']
  },
  {
    key: 'geolocation',
    label: 'Location',
    description: 'Access your location',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    options: ['allow', 'block', 'ask']
  },
  {
    key: 'popups',
    label: 'Pop-ups & Redirects',
    description: 'Open pop-ups and new windows',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    ),
    options: ['allow', 'block']
  },
  {
    key: 'javascript',
    label: 'JavaScript',
    description: 'Run JavaScript on this site',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    options: ['allow', 'block']
  },
  {
    key: 'cookies',
    label: 'Cookies',
    description: 'Store cookies and site data',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10" />
        <path d="M12 8v4l3 3" />
        <circle cx="18" cy="5" r="3" />
      </svg>
    ),
    options: ['allow', 'block']
  },
  {
    key: 'images',
    label: 'Images',
    description: 'Show images on this site',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    options: ['allow', 'block']
  },
  {
    key: 'adblock',
    label: 'Ad Blocker',
    description: 'Block ads on this site',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
    options: ['allow', 'block', 'ask']
  }
]

const PERMISSION_LABELS: Record<PermissionValue, string> = {
  allow: 'Allow',
  block: 'Block',
  ask: 'Ask'
}

const PERMISSION_COLORS: Record<PermissionValue, string> = {
  allow: 'var(--success)',
  block: 'var(--danger)',
  ask: 'var(--warning)'
}

function PermissionRow({
  def,
  value,
  defaultValue,
  onChange
}: {
  def: PermissionDef
  value: PermissionValue
  defaultValue: PermissionValue
  onChange: (v: PermissionValue) => void
}) {
  const isCustom = value !== defaultValue
  return (
    <div className={`permission-row ${isCustom ? 'customized' : ''}`}>
      <div className="permission-icon">{def.icon}</div>
      <div className="permission-info">
        <div className="permission-label">
          {def.label}
          {isCustom && <span className="custom-badge">Custom</span>}
        </div>
        <div className="permission-desc">{def.description}</div>
      </div>
      <div className="permission-control">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as PermissionValue)}
          className={`perm-select perm-${value}`}
          style={{ color: PERMISSION_COLORS[value] }}
        >
          {def.options.map((opt) => (
            <option key={opt} value={opt}>
              {PERMISSION_LABELS[opt]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function SiteSettingsPanel({ url, onClose }: SiteSettingsPanelProps): JSX.Element {
  const [siteData, setSiteData] = useState<SiteSettings | null>(null)
  const [defaults, setDefaults] = useState<SitePermissions | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saveFlash, setSaveFlash] = useState(false)

  // Derive origin from URL
  const origin = (() => {
    try {
      if (!url || url.startsWith('brah://') || url.startsWith('data:')) return null
      const u = new URL(url.startsWith('http') ? url : `https://${url}`)
      return u.origin
    } catch {
      return null
    }
  })()

  const displayOrigin = origin || url
  const domain = (() => {
    try {
      return new URL(displayOrigin).hostname.replace(/^www\./, '')
    } catch {
      return displayOrigin
    }
  })()

  useEffect(() => {
    if (!origin) {
      setIsLoading(false)
      return
    }

    const load = async () => {
      try {
        const [site, defs] = await Promise.all([
          window.siteSettings?.get(origin),
          window.siteSettings?.getDefaults()
        ])
        setSiteData(site || { origin, permissions: {} })
        setDefaults(defs || null)
      } catch (err) {
        console.error('Failed to load site settings:', err)
        setSiteData({ origin: origin || '', permissions: {} })
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [origin])

  const getPermValue = useCallback(
    (key: PermKey): PermissionValue => {
      if (!siteData) return 'ask'
      return (siteData.permissions[key] ?? defaults?.[key] ?? 'ask') as PermissionValue
    },
    [siteData, defaults]
  )

  const getDefaultValue = useCallback(
    (key: PermKey): PermissionValue => {
      return defaults?.[key] ?? 'ask'
    },
    [defaults]
  )

  const handlePermChange = useCallback(
    async (key: PermKey, value: PermissionValue) => {
      if (!origin) return
      // Optimistic update
      setSiteData((prev) =>
        prev
          ? {
              ...prev,
              permissions: { ...prev.permissions, [key]: value }
            }
          : null
      )

      try {
        await window.siteSettings?.setPermission(origin, key, value)
        setSaveFlash(true)
        setTimeout(() => setSaveFlash(false), 800)
      } catch (err) {
        console.error('Failed to save permission:', err)
      }
    },
    [origin]
  )

  const handleReset = useCallback(async () => {
    if (!origin) return
    if (!confirm(`Reset all permissions for ${domain}?`)) return
    try {
      await window.siteSettings?.reset(origin)
      setSiteData({ origin, permissions: {} })
    } catch {}
  }, [origin, domain])

  const hasCustomPermissions = siteData
    ? PERMISSION_DEFS.some((def) => {
        const current = siteData.permissions[def.key]
        const def_default = defaults?.[def.key]
        return current !== undefined && current !== def_default
      })
    : false

  if (!origin) {
    return (
      <div className="panel site-settings-panel">
        <div className="panel-header">
          <h3>Site Settings</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="panel-content">
          <div className="empty-state">
            <div className="empty-icon">🏠</div>
            <p>No site settings</p>
            <small>Site settings are not available for internal pages</small>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel site-settings-panel">
      <div className="panel-header">
        <h3>Site Settings</h3>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      {/* Site identity */}
      <div className="site-identity">
        <div className="site-identity-icon">
          <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
            alt=""
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
        <div className="site-identity-info">
          <div className="site-domain">{domain}</div>
          <div className="site-origin">{displayOrigin}</div>
        </div>
        {saveFlash && <div className="save-flash">Saved ✓</div>}
      </div>

      <div className="panel-content">
        {isLoading ? (
          <div className="loading-state">Loading permissions…</div>
        ) : (
          <>
            <div className="permissions-section">
              <div className="permissions-label">Permissions</div>
              {PERMISSION_DEFS.map((def) => (
                <PermissionRow
                  key={def.key}
                  def={def}
                  value={getPermValue(def.key)}
                  defaultValue={getDefaultValue(def.key)}
                  onChange={(v) => handlePermChange(def.key, v)}
                />
              ))}
            </div>

            {hasCustomPermissions && (
              <div className="site-settings-footer">
                <button className="reset-site-btn" onClick={handleReset}>
                  Reset to defaults
                </button>
              </div>
            )}

            <div className="site-info-section">
              <div className="permissions-label">Connection</div>
              <div className="connection-info">
                <div className="connection-row">
                  <span className="conn-label">Protocol</span>
                  <span className={`conn-value ${url.startsWith('https') ? 'secure' : 'insecure'}`}>
                    {url.startsWith('https') ? '🔒 HTTPS (Secure)' : '⚠️ HTTP (Not secure)'}
                  </span>
                </div>
                <div className="connection-row">
                  <span className="conn-label">Origin</span>
                  <span className="conn-value mono">{displayOrigin}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
