import { useState, JSX } from 'react'
import '../styles/Panel.css'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps): JSX.Element {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('brah-settings')
    if (!saved) return 'dark'
    try {
      const settings = JSON.parse(saved)
      return settings.theme === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  const [searchEngine, setSearchEngine] = useState(() => {
    const saved = localStorage.getItem('brah-settings')
    if (!saved) return 'google'
    try {
      const settings = JSON.parse(saved)
      return typeof settings.searchEngine === 'string' ? settings.searchEngine : 'google'
    } catch {
      return 'google'
    }
  })

  const [homepage, setHomepage] = useState(() => {
    const saved = localStorage.getItem('brah-settings')
    if (!saved) return 'https://www.google.com'
    try {
      const settings = JSON.parse(saved)
      return typeof settings.homepage === 'string' ? settings.homepage : 'https://www.google.com'
    } catch {
      return 'https://www.google.com'
    }
  })

  const saveSettings = (): void => {
    const settings = { theme, searchEngine, homepage }
    localStorage.setItem('brah-settings', JSON.stringify(settings))
    onClose()
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
        <div className="setting-item">
          <label>Theme</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value as any)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Search Engine</label>
          <select value={searchEngine} onChange={(e) => setSearchEngine(e.target.value)}>
            <option value="google">Google</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="bing">Bing</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Homepage</label>
          <input type="text" value={homepage} onChange={(e) => setHomepage(e.target.value)} />
        </div>

        <button className="save-btn" onClick={saveSettings}>
          Save Settings
        </button>
      </div>
    </div>
  )
}
