import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { const saved = localStorage.getItem('myhome-theme'); if (saved === 'light' || saved === 'dark') return saved } catch { /* Storage may be blocked. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1b1c21' : '#f7f7fb')
    try { localStorage.setItem('myhome-theme', theme) } catch { /* Theme still works without persistence. */ }
  }, [theme])
  return [theme, setTheme] as const
}
