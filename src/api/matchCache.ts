import type { OpenDotaMatch } from '../types'

const DB_NAME = 'ruiner-match-cache'
const STORE = 'matches'
const MAX_ENTRIES = 24

type CacheRow = {
  matchId: number
  savedAt: number
  source: string
  match: OpenDotaMatch
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'matchId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

export async function readMatchCache(
  matchId: number,
): Promise<{ match: OpenDotaMatch; source: string; savedAt: number } | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(matchId)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const row = req.result as CacheRow | undefined
        if (!row?.match) resolve(null)
        else
          resolve({
            match: row.match,
            source: row.source || 'cache',
            savedAt: row.savedAt,
          })
      }
    })
  } catch {
    return null
  }
}

export async function writeMatchCache(
  matchId: number,
  match: OpenDotaMatch,
  source: string,
): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).put({
        matchId,
        savedAt: Date.now(),
        source,
        match,
      } satisfies CacheRow)
    })
    await trimCache(db)
  } catch {
    // кэш необязателен
  }
}

async function trimCache(db: IDBDatabase): Promise<void> {
  const rows = await new Promise<CacheRow[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve((req.result as CacheRow[]) ?? [])
  })
  if (rows.length <= MAX_ENTRIES) return
  const drop = [...rows]
    .sort((a, b) => a.savedAt - b.savedAt)
    .slice(0, rows.length - MAX_ENTRIES)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    const store = tx.objectStore(STORE)
    for (const row of drop) store.delete(row.matchId)
  })
}
