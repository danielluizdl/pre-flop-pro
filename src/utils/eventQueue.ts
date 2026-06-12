const KEY = 'pfp-event-queue'
const CAP = 500

export interface QueueItem {
  path: string
  body: object
  ts: number
}

function read(): QueueItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function write(items: QueueItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* cota estourada: descarta silenciosamente */
  }
}

let flushing = false

export function enqueue(path: string, body: object, token: string | null): void {
  if (!token) return
  const items = read()
  items.push({ path, body, ts: Date.now() })
  while (items.length > CAP) items.shift()
  write(items)
  void flush(token)
}

export async function flush(token: string | null): Promise<void> {
  if (!token || flushing) return
  flushing = true
  try {
    while (true) {
      const items = read()
      if (items.length === 0) break
      const item = items[0]
      let res: Response
      try {
        res = await fetch(`/api/events/${item.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(item.body),
        })
      } catch {
        break
      }
      if (res.ok || res.status === 400) {
        const cur = read()
        cur.shift()
        write(cur)
      } else {
        break
      }
    }
  } finally {
    flushing = false
  }
}
