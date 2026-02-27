import { useState, useEffect, JSX } from 'react'
import '../styles/Panel.css'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps): JSX.Element {
  type SettingsState = {
    theme: 'dark' | 'light'
    searchEngine: string
    homepage: string
    enableAdBlock: boolean
    enableNotifications: boolean
    spellcheck: boolean
    downloadPath: string
  }

  const [settings, setSettings] = useState<SettingsState>({
    theme: 'dark' as 'dark' | 'light',
    searchEngine: 'google',
    homepage: 'https://www.google.com',
    enableAdBlock: false,
    enableNotifications: true,
    spellcheck: true,
    downloadPath: ''
  })
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [clearOptions, setClearOptions] = useState({
    history: true,
    downloads: true,
    bookmarks: true,
    cookies: true,
    cache: false,
    siteData: true
  })
  const [clearStatus, setClearStatus] = useState<'idle' | 'clearing' | 'cleared'>('idle')

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const saved = await window.settings?.get()
        if (saved) {
          setSettings((prev) => ({ ...prev, ...saved }))
          // Apply theme immediately
          applyTheme(saved.theme ?? 'dark')
        } else {
          // Fallback to localStorage
          const local = localStorage.getItem('brah-settings')
          if (local) {
            const parsed = JSON.parse(local)
            setSettings((prev) => ({ ...prev, ...parsed }))
            applyTheme(parsed.theme ?? 'dark')
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()

    // Listen for settings changes from other windows
    const cleanup = window.settings?.onChange((newSettings) => {
      setSettings((prev) => ({ ...prev, ...newSettings }))
      applyTheme(newSettings.theme ?? 'dark')
    })

    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  const applyTheme = (theme: 'dark' | 'light'): void => {
    document.documentElement.setAttribute('data-theme', theme)
    document.body.classList.remove('dark', 'light')
    document.body.classList.add(theme)
  }

  const handleChange = (key: string, value: any): void => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    // Apply theme immediately for preview
    if (key === 'theme') {
      applyTheme(value)
    }
  }

  const saveSettings = async (): Promise<void> => {
    setSaveStatus('saving')
    try {
      // Save to electron-store via IPC
      if (window.settings) {
        await window.settings.set(settings)
      }
      // Also save to localStorage as backup
      localStorage.setItem('brah-settings', JSON.stringify(settings))

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1000)
      onClose()
    } catch (error) {
      console.error('Failed to save settings:', error)
      setSaveStatus('idle')
    }
  }

  const resetSettings = async (): Promise<void> => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      try {
        const defaults = await window.settings?.reset()
        if (defaults) {
          setSettings((prev) => ({ ...prev, ...defaults }))
          applyTheme(defaults.theme ?? 'dark')
        }
      } catch (error) {
        console.error('Failed to reset settings:', error)
      }
    }
  }

  const toggleAllClearOptions = (checked: boolean): void => {
    setClearOptions({
      history: checked,
      downloads: checked,
      bookmarks: checked,
      cookies: checked,
      cache: checked,
      siteData: checked
    })
  }

  const clearSelectedData = async (): Promise<void> => {
    const nothingSelected = Object.values(clearOptions).every((v) => !v)
    if (nothingSelected) {
      alert('Select at least one item to clear.')
      return
    }

    if (!confirm('Clear selected data? This cannot be undone.')) return

    setClearStatus('clearing')
    const cleared: Record<string, boolean> = {}

    try {
      if (clearOptions.history) {
        localStorage.removeItem('brah-history')
        cleared.history = true
      }

      if (clearOptions.bookmarks) {
        localStorage.removeItem('brah-bookmarks')
        cleared.bookmarks = true
      }

      if (clearOptions.downloads) {
        try {
          await window.downloads?.clearAll?.()
        } catch {
          // ignore
        }
        cleared.downloads = true
      }

      if (clearOptions.cookies || clearOptions.cache || clearOptions.siteData) {
        const result = await window.privacy?.clearData?.({
          cookies: clearOptions.cookies,
          cache: clearOptions.cache,
          siteData: clearOptions.siteData
        })
        if (result && !result.success) {
          throw new Error(result.error || 'Failed to clear browser data')
        }
        cleared.cookies = !!clearOptions.cookies
        cleared.cache = !!clearOptions.cache
        cleared.siteData = !!clearOptions.siteData
      }

      window.dispatchEvent(new CustomEvent('app:data-cleared', { detail: cleared }))
      setClearStatus('cleared')
      setTimeout(() => setClearStatus('idle'), 1200)
    } catch (err) {
      console.error('Clear data failed:', err)
      alert(`Clear failed: ${String(err)}`)
      setClearStatus('idle')
    }
  }

  if (isLoading) {
    return (
      <div className="panel settings-panel">
        <div className="panel-header">
          <h3>Settings</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="panel-content">
          <div className="loading-state">Loading settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel settings-panel">
      <div className="panel-header">
        <h3>Settings</h3>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="panel-content settings-content">
        <section className="settings-section">
          <h4>Appearance</h4>
          <div className="setting-item">
            <label htmlFor="theme">Theme</label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(e) => handleChange('theme', e.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System Default</option>
            </select>
          </div>
        </section>

        <section className="settings-section">
          <h4>Search & Navigation</h4>
          <div className="setting-item">
            <label htmlFor="searchEngine">Default Search Engine</label>
            <select
              id="searchEngine"
              value={settings.searchEngine}
              onChange={(e) => handleChange('searchEngine', e.target.value)}
            >
              <option value="google">Google</option>
              <option value="duckduckgo">DuckDuckGo</option>
              <option value="bing">Bing</option>
              <option value="brave">Brave Search</option>
              <option value="ecosia">Ecosia</option>
            </select>
          </div>

          <div className="setting-item">
            <label htmlFor="homepage">Homepage</label>
            <input
              id="homepage"
              type="text"
              value={settings.homepage}
              onChange={(e) => handleChange('homepage', e.target.value)}
              placeholder="https://www.google.com"
            />
          </div>
        </section>

        <section className="settings-section">
          <h4>Privacy & Security</h4>
          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={settings.enableAdBlock}
                onChange={(e) => handleChange('enableAdBlock', e.target.checked)}
              />
              Enable Ad Blocker (Experimental)
            </label>
          </div>
          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={settings.enableNotifications}
                onChange={(e) => handleChange('enableNotifications', e.target.checked)}
              />
              Allow Website Notifications
            </label>
          </div>
          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={settings.spellcheck}
                onChange={(e) => handleChange('spellcheck', e.target.checked)}
              />
              Enable Spell Check
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h4>Downloads</h4>
          <div className="setting-item">
            <label htmlFor="downloadPath">Default Download Location</label>
            <input
              id="downloadPath"
              type="text"
              value={settings.downloadPath || ''}
              onChange={(e) => handleChange('downloadPath', e.target.value)}
              placeholder="Downloads folder"
            />
            <small>Leave empty to use system Downloads folder</small>
          </div>
        </section>

        <section className="settings-section">
          <h4>Clear Data</h4>
          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={Object.values(clearOptions).every(Boolean)}
                onChange={(e) => toggleAllClearOptions(e.target.checked)}
              />
              Select all
            </label>
          </div>

          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={clearOptions.history}
                onChange={(e) => setClearOptions((p) => ({ ...p, history: e.target.checked }))}
              />
              History
            </label>
          </div>

          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={clearOptions.downloads}
                onChange={(e) => setClearOptions((p) => ({ ...p, downloads: e.target.checked }))}
              />
              Downloads list
            </label>
          </div>

          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={clearOptions.bookmarks}
                onChange={(e) => setClearOptions((p) => ({ ...p, bookmarks: e.target.checked }))}
              />
              Bookmarks
            </label>
          </div>

          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={clearOptions.cookies}
                onChange={(e) => setClearOptions((p) => ({ ...p, cookies: e.target.checked }))}
              />
              Cookies (sign out)
            </label>
          </div>

          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={clearOptions.siteData}
                onChange={(e) => setClearOptions((p) => ({ ...p, siteData: e.target.checked }))}
              />
              Site data (local storage)
            </label>
          </div>

          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={clearOptions.cache}
                onChange={(e) => setClearOptions((p) => ({ ...p, cache: e.target.checked }))}
              />
              Cache
            </label>
          </div>

          <div className="settings-actions">
            <button
              className="save-btn"
              onClick={clearSelectedData}
              disabled={clearStatus === 'clearing'}
            >
              {clearStatus === 'clearing'
                ? 'Clearing...'
                : clearStatus === 'cleared'
                  ? 'Cleared!'
                  : 'Clear Selected'}
            </button>
          </div>
        </section>

        <div className="settings-actions">
          <button className="save-btn" onClick={saveSettings} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving'
              ? 'Saving...'
              : saveStatus === 'saved'
                ? 'Saved!'
                : 'Save Settings'}
          </button>
          <button className="reset-btn" onClick={resetSettings}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  )
}
