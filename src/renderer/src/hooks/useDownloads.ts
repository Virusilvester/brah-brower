import { useState, useEffect, useCallback } from 'react'
import type { DownloadItem } from '../../../preload/index.d'

export interface UseDownloadsResult {
  downloads: DownloadItem[]
  clearCompletedDownloads: () => void
  removeDownload: (id: string) => void
  deleteDownload: (id: string, path: string) => void // NEW: remove + delete file
  pauseDownload: (id: string) => void
  resumeDownload: (id: string) => void
  cancelDownload: (id: string) => void
}

export function useDownloads(): UseDownloadsResult {
  const [downloads, setDownloads] = useState<DownloadItem[]>([])

  useEffect(() => {
    const downloadsApi = window.downloads
    if (!downloadsApi) return

    let isMounted = true
    const refresh = (): void => {
      void downloadsApi
        .getAll?.()
        .then((existing) => {
          if (!isMounted) return
          if (Array.isArray(existing)) setDownloads(existing)
        })
        .catch(() => {
          // ignore
        })
    }

    const clearHandler = (e: Event): void => {
      const detail = (e as CustomEvent).detail as Record<string, unknown> | undefined
      if (detail?.downloads) refresh()
    }

    window.addEventListener('app:data-cleared', clearHandler as EventListener)

    void downloadsApi
      .getAll?.()
      .then((existing) => {
        if (!isMounted) return
        if (Array.isArray(existing)) setDownloads(existing)
      })
      .catch(() => {
        // ignore
      })

    const cleanupStarted = downloadsApi.onStarted((data) => {
      setDownloads((prev) => {
        const idx = prev.findIndex((d) => d.id === data.id)
        if (idx === -1) return [data, ...prev]
        const next = [...prev]
        next.splice(idx, 1)
        return [data, ...next]
      })
    })

    const cleanupProgress = downloadsApi.onProgress((data) => {
      setDownloads((prev) => {
        const idx = prev.findIndex((d) => d.id === data.id)
        if (idx === -1) return [data, ...prev]
        const next = [...prev]
        next[idx] = data
        return next
      })
    })

    const cleanupCompleted = downloadsApi.onCompleted((data) => {
      setDownloads((prev) => {
        const idx = prev.findIndex((d) => d.id === data.id)
        if (idx === -1) return [data, ...prev]
        const next = [...prev]
        next[idx] = data
        return next
      })
    })

    return () => {
      isMounted = false
      window.removeEventListener('app:data-cleared', clearHandler as EventListener)
      cleanupStarted()
      cleanupProgress()
      cleanupCompleted()
    }
  }, [])

  const clearCompletedDownloads = useCallback(() => {
    const api = window.downloads
    if (api?.clearCompleted) {
      void api.clearCompleted().then((next) => {
        if (Array.isArray(next)) setDownloads(next)
      })
      return
    }
    setDownloads((prev) => prev.filter((d) => d.state === 'progressing'))
  }, [])

  const removeDownload = useCallback((id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id))
    void window.downloads?.remove?.(id)
  }, [])

  // NEW: Delete download - remove from list and delete the file
  const deleteDownload = useCallback(async (id: string, path: string) => {
    try {
      const result = await window.downloads?.delete?.(id, path)
      if (result?.success) {
        setDownloads((prev) => prev.filter((d) => d.id !== id))
        return
      }
      if (result?.error) {
        alert(`Delete failed: ${result.error}`)
      } else {
        alert('Delete failed')
      }
    } catch (err) {
      console.error('Failed to delete file:', err)
      alert('Delete failed')
    }
  }, [])

  const pauseDownload = useCallback((id: string) => {
    window.downloads?.pause(id)
  }, [])

  const resumeDownload = useCallback((id: string) => {
    window.downloads?.resume(id)
  }, [])

  const cancelDownload = useCallback((id: string) => {
    window.downloads?.cancel(id)
  }, [])

  return {
    downloads,
    clearCompletedDownloads,
    removeDownload,
    deleteDownload, // NEW
    pauseDownload,
    resumeDownload,
    cancelDownload
  }
}
