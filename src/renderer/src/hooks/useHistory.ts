import { useState, useCallback, useEffect } from 'react'

export interface HistoryItem {
  id: string
  title: string
  url: string
  timestamp: number
  favicon?: string
}

const MAX_HISTORY_ITEMS = 500

export function useHistory() {
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

  const addToHistory = useCallback((title: string, url: string) => {
    // Don't add empty URLs or chrome:// URLs
    if (!url || url.startsWith('chrome://') || url.startsWith('file://')) return

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
    searchHistory
  }
}
