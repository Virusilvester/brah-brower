import { useState, useEffect, useCallback } from 'react'

export interface UseAdBlockResult {
  enabled: boolean
  blockedCount: number
  setEnabled: (value: boolean) => Promise<void>
  resetStats: () => Promise<void>
  toggle: () => Promise<void>
}

export function useAdBlock(): UseAdBlockResult {
  const [enabled, setEnabledState] = useState(false)
  const [blockedCount, setBlockedCount] = useState(0)

  useEffect(() => {
    const api = window.adBlock
    if (!api) return

    let mounted = true

    // Load initial state
    api
      .isEnabled()
      .then((v) => {
        if (mounted) setEnabledState(v)
      })
      .catch(() => {})
    api
      .getBlockedCount()
      .then((v) => {
        if (mounted) setBlockedCount(v)
      })
      .catch(() => {})

    // Subscribe to count changes
    const cleanup = api.onBlockedCountChange((count) => {
      if (mounted) setBlockedCount(count)
    })

    return () => {
      mounted = false
      cleanup()
    }
  }, [])

  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value)
    try {
      await window.adBlock?.setEnabled(value)
    } catch {}
  }, [])

  const toggle = useCallback(async () => {
    const next = !enabled
    setEnabledState(next)
    try {
      await window.adBlock?.setEnabled(next)
    } catch {}
  }, [enabled])

  const resetStats = useCallback(async () => {
    setBlockedCount(0)
    try {
      await window.adBlock?.resetStats()
    } catch {}
  }, [])

  return { enabled, blockedCount, setEnabled, resetStats, toggle }
}
