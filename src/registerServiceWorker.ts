export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) return

  const register = () => {
    const scope = new URL(import.meta.env.BASE_URL, window.location.href)
    navigator.serviceWorker.register(new URL('sw.js', scope), {
      scope: scope.href,
      updateViaCache: 'none',
    }).catch((error: unknown) => {
      console.warn('Offline support could not be enabled:', error)
    })
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
