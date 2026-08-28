/** Per-device identity + heartbeat for multi-device counters.
 *  One stable id per browser; section+role tell which counter that phone is on. */

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem('fc.deviceId')
    if (id && /^[A-Za-z0-9_-]{8,64}$/.test(id)) return id
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)).replace(/-/g, '')
    id = id.slice(0, 32)
    localStorage.setItem('fc.deviceId', id)
    return id
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2, 10)
  }
}

export function registerDevice(section: string, role: string): void {
  try {
    fetch('/api/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), section, role }),
    }).catch(() => {})
  } catch {}
}

export function startDeviceHeartbeat(section: string, role: string): () => void {
  registerDevice(section, role)
  const t = setInterval(() => registerDevice(section, role), 30000)
  const onVis = () => { if (document.visibilityState === 'visible') registerDevice(section, role) }
  document.addEventListener('visibilitychange', onVis)
  return () => {
    clearInterval(t)
    document.removeEventListener('visibilitychange', onVis)
  }
}
