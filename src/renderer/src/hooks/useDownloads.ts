import { useState, useEffect, useCallback } from 'react'
import type { DownloadItem } from '../../preload/index.d'

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([])

  useEffect(() => {
    window.downloads.onStarted((data) => {
      setDownloads((prev) => [data, ...prev])
    })

    window.downloads.onProgress((data) => {
      setDownloads((prev) => prev.map((d) => (d.id === data.id ? data : d)))
    })

    window.downloads.onCompleted((data) => {
      setDownloads((prev) => prev.map((d) => (d.id === data.id ? data : d)))
    })
  }, [])

  const clearCompletedDownloads = useCallback(() => {
    setDownloads((prev) => prev.filter((d) => d.state === 'progressing'))
  }, [])

  const removeDownload = useCallback((id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return {
    downloads,
    clearCompletedDownloads,
    removeDownload
  }
}
