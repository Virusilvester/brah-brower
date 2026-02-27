import { useState, useCallback, useEffect } from 'react'

export interface HistoryItem {
  id: string
  title: string
  url: string
  timestamp: number
  favicon?: string
}

const MAX_HISTORY_ITEMS = 500

export interface UseHistoryResult {
  history: HistoryItem[]
  addToHistory: (title: string, url: string) => void
  clearHistory: () => void
  removeFromHistory: (id: string) => void
  removeFromHistoryByUrl: (url: string) => void
  removeFromHistoryByHost: (host: string) => void
  searchHistory: (query: string) => HistoryItem[]
}

export function useHistory(): UseHistoryResult {
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('brah-history')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })

  // Persist history
  useEffect(() => {
    localStorage.setItem('brah-history', JSON.stringify(history))
  }, [history])

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent).detail as Record<string, unknown> | undefined
      if (detail?.history) setHistory([])
    }
    window.addEventListener('app:data-cleared', handler as EventListener)
    return () => window.removeEventListener('app:data-cleared', handler as EventListener)
  }, [])

  const addToHistory = useCallback((title: string, url: string) => {
    // Don't add empty URLs or chrome:// URLs
    if (
      !url ||
      url.startsWith('chrome://') ||
      url.startsWith('file://') ||
      url.startsWith('brah://')
    )
      return

    setHistory((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter((item) => item.url !== url)

      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        title: title || url,
        url,
        timestamp: Date.now()
      }

      // Add to beginning and limit size
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS)
      return updated
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const removeFromHistoryByUrl = useCallback((url: string) => {
    if (!url) return
    setHistory((prev) => prev.filter((item) => item.url !== url))
  }, [])

  const removeFromHistoryByHost = useCallback((host: string) => {
    const normalized = (host || '').replace(/^www\./, '').trim()
    if (!normalized) return
    setHistory((prev) =>
      prev.filter((item) => {
        try {
          const itemHost = new URL(item.url).hostname.replace(/^www\./, '')
          return itemHost !== normalized
        } catch {
          return true
        }
      })
    )
  }, [])

  const searchHistory = useCallback(
    (query: string) => {
      const lowerQuery = query.toLowerCase()
      return history.filter(
        (item) =>
          item.title.toLowerCase().includes(lowerQuery) ||
          item.url.toLowerCase().includes(lowerQuery)
      )
    },
    [history]
  )

  return {
    history,
    addToHistory,
    clearHistory,
    removeFromHistory,
    removeFromHistoryByUrl,
    removeFromHistoryByHost,
    searchHistory
  }
}
