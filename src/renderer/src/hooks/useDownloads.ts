import { useState, useEffect, useCallback } from 'react'
import type { DownloadItem } from '../../../preload/index.d'

export interface UseDownloadsResult {
  downloads: DownloadItem[]
  clearCompletedDownloads: () => void
  removeDownload: (id: string) => void
  pauseDownload: (id: string) => void
  resumeDownload: (id: string) => void
  cancelDownload: (id: string) => void
}

export function useDownloads(): UseDownloadsResult {
  const [downloads, setDownloads] = useState<DownloadItem[]>([])

  useEffect(() => {
    const downloadsApi = window.downloads
    if (!downloadsApi) return

    const cleanupStarted = downloadsApi.onStarted((data) => {
      setDownloads((prev) => [data, ...prev])
    })

    const cleanupProgress = downloadsApi.onProgress((data) => {
      setDownloads((prev) => prev.map((d) => (d.id === data.id ? data : d)))
    })

    const cleanupCompleted = downloadsApi.onCompleted((data) => {
      setDownloads((prev) => prev.map((d) => (d.id === data.id ? data : d)))
    })

    return () => {
      cleanupStarted()
      cleanupProgress()
      cleanupCompleted()
    }
  }, [])

  const clearCompletedDownloads = useCallback(() => {
    setDownloads((prev) => prev.filter((d) => d.state === 'progressing'))
  }, [])

  const removeDownload = useCallback((id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const pauseDownload = useCallback((id: string) => {
    window.downloads?.pause(id)
  }, [])

  const resumeDownload = useCallback((id: string) => {
    window.downloads?.resume(id)
  }, [])

  const cancelDownload = useCallback(
    (id: string) => {
      window.downloads?.cancel(id)
      removeDownload(id)
    },
    [removeDownload]
  )

  return {
    downloads,
    clearCompletedDownloads,
    removeDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload
  }
}
