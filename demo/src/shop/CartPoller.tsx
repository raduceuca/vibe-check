// VIBECHECK-FAULT: console-spam
import { useEffect } from 'react'

export const CartPoller = () => {
  useEffect(() => {
    const id = window.setInterval(() => {
      console.log('[cart] polling', Date.now())
    }, 300)
    return () => window.clearInterval(id)
  }, [])

  return null
}
