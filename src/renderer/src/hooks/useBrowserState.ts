import { useState, useCallback, useEffect } from 'react'
import type { Tab } from '../App'

const HOME_URL = 'https://www.google.com'

export function useBrowserState() {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = localStorage.getItem('brah-tabs')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.map((t: Tab) => ({
          ...t,
          url: t.url || HOME_URL
        }))
      } catch {
        return [{ id: crypto.randomUUID(), title: 'New Tab', url: HOME_URL }]
      }
    }
    return [{ id: crypto.randomUUID(), title: 'New Tab', url: HOME_URL }]
  })

  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || '')

  // Persist tabs
  useEffect(() => {
    localStorage.setItem('brah-tabs', JSON.stringify(tabs))
  }, [tabs])

  const addTab = useCallback((url: string = HOME_URL) => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      title: 'New Tab',
      url: url || HOME_URL
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
  }, [])

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length === 1) {
          const resetTab: Tab = {
            id: crypto.randomUUID(),
            title: 'New Tab',
            url: HOME_URL
          }
          setActiveTabId(resetTab.id)
          return [resetTab]
        }

        const newTabs = prev.filter((t) => t.id !== id)
        if (id === activeTabId && newTabs.length > 0) {
          setActiveTabId(newTabs[newTabs.length - 1].id)
        }
        return newTabs
      })
    },
    [activeTabId]
  )

  const setActiveTab = useCallback((id: string) => {
    setActiveTabId(id)
  }, [])

  // NEW: Reorder tabs
  const reorderTabs = useCallback((dragIndex: number, hoverIndex: number) => {
    setTabs((prev) => {
      const dragTab = prev[dragIndex]
      const newTabs = [...prev]
      // Remove dragged tab
      newTabs.splice(dragIndex, 1)
      // Insert at new position
      newTabs.splice(hoverIndex, 0, dragTab)
      return newTabs
    })
  }, [])

  const updateTab = useCallback((id: string, updates: Partial<Tab>) => {
    setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, ...updates } : tab)))
  }, [])

  const updateTabLoading = useCallback((id: string, isLoading: boolean) => {
    setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, isLoading } : tab)))
  }, [])

  const updateTabNavigationState = useCallback(
    (id: string, canGoBack: boolean, canGoForward: boolean) => {
      setTabs((prev) =>
        prev.map((tab) => (tab.id === id ? { ...tab, canGoBack, canGoForward } : tab))
      )
    },
    []
  )

  return {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    reorderTabs, // Export new function
    updateTab,
    updateTabLoading,
    updateTabNavigationState
  }
}
