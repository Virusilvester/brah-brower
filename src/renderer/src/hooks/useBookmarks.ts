import { useState, useCallback, useEffect } from 'react'

export interface BookmarkItem {
  id: string
  title: string
  url: string
  favicon?: string
  createdAt: number
  folder?: string
}

export interface UseBookmarksResult {
  bookmarks: BookmarkItem[]
  addBookmark: (title: string, url: string, folder?: string) => void
  removeBookmark: (id: string) => void
  removeBookmarkByUrl: (url: string) => void
  isBookmarked: (url: string) => boolean
  toggleBookmark: (title: string, url: string) => void
  updateBookmark: (id: string, updates: Partial<BookmarkItem>) => void
}

export function useBookmarks(): UseBookmarksResult {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    const saved = localStorage.getItem('brah-bookmarks')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })

  useEffect(() => {
    localStorage.setItem('brah-bookmarks', JSON.stringify(bookmarks))
  }, [bookmarks])

  const addBookmark = useCallback(
    (title: string, url: string, folder?: string) => {
      if (!url) return

      // Don't add if already exists
      if (bookmarks.some((b) => b.url === url)) return

      const newBookmark: BookmarkItem = {
        id: crypto.randomUUID(),
        title: title || url,
        url,
        createdAt: Date.now(),
        folder
      }

      setBookmarks((prev) => [...prev, newBookmark])
    },
    [bookmarks]
  )

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }, [])

  // NEW: Remove bookmark by URL (for toggle functionality)
  const removeBookmarkByUrl = useCallback((url: string) => {
    setBookmarks((prev) => prev.filter((b) => b.url !== url))
  }, [])

  const isBookmarked = useCallback(
    (url: string) => {
      return bookmarks.some((b) => b.url === url)
    },
    [bookmarks]
  )

  const toggleBookmark = useCallback(
    (title: string, url: string) => {
      if (isBookmarked(url)) {
        removeBookmarkByUrl(url)
      } else {
        addBookmark(title, url)
      }
    },
    [isBookmarked, removeBookmarkByUrl, addBookmark]
  )

  const updateBookmark = useCallback((id: string, updates: Partial<BookmarkItem>) => {
    setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)))
  }, [])

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    removeBookmarkByUrl, // Export new function
    isBookmarked,
    toggleBookmark, // Export toggle function
    updateBookmark
  }
}
