import { expectedSeries } from '../data/expectations'
import type { HeroMeta, MatchPlayer, OpenDotaMatch } from '../types'
import { readMatchCache, writeMatchCache } from './matchCache'
import { steamDetailsUrl, steamToOpenDota } from './steamMatch'

const API = 'https://api.opendota.com/api'
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes'
const FETCH_MS = 12000

export type MatchDataSource = 'opendota' | 'steam' | 'cache' | 'proxy'

function matchProxyBase(): string {
  const fromEnv = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_MATCH_PROXY
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/$/, '')
  try {
    const local = localStorage.getItem('ruiner_match_proxy')?.trim()
    if (local) return local.replace(/\/$/, '')
  } catch {
    // ignore
  }
  return ''
}

function steamApiKey(): string {
  try {
    return localStorage.getItem('ruiner_steam_key')?.trim() || ''
  } catch {
    return ''
  }
}

/** CORS-прокси только как запасной канал к Steam (ключ не идеален, но лучше чем тишина). */
const STEAM_CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) =>
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
]

let heroesCache: HeroMeta[] | null = null
let heroesById: Map<number, HeroMeta> | null = null
let heroesInflight: Promise<HeroMeta[]> | null = null
let itemsById: Map<number, string> | null = null
let itemsInflight: Promise<Map<number, string>> | null = null

class FetchTimeoutError extends Error {
  constructor(message = 'OpenDota не ответила вовремя. Попробуй ещё раз.') {
    super(message)
    this.name = 'TimeoutError'
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  )
}

/** Таймаут ≠ отмена пользователя: reason остаётся TimeoutError. */
function mergeSignal(signal?: AbortSignal, ms = FETCH_MS): {
  signal: AbortSignal
  cleanup: () => void
} {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => {
    ctrl.abort(new FetchTimeoutError())
  }, ms)

  const onUserAbort = () => {
    ctrl.abort(
      signal?.reason instanceof Error
        ? signal.reason
        : new DOMException('Aborted', 'AbortError'),
    )
  }

  if (signal) {
    if (signal.aborted) onUserAbort()
    else signal.addEventListener('abort', onUserAbort, { once: true })
  }

  return {
    signal: ctrl.signal,
    cleanup: () => {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onUserAbort)
    },
  }
}

export async function fetchHeroes(signal?: AbortSignal): Promise<HeroMeta[]> {
  if (heroesCache) return heroesCache
  if (!heroesInflight) {
    heroesInflight = (async () => {
      const res = await fetchRetry(`${API}/heroes`)
      if (!res.ok) throw new Error('Не удалось загрузить список героев')
      heroesCache = (await res.json()) as HeroMeta[]
      heroesById = new Map(heroesCache.map((h) => [h.id, h]))
      return heroesCache
    })().finally(() => {
      heroesInflight = null
    })
  }
  const list = await heroesInflight
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return list
}

async function fetchItemIndex(signal?: AbortSignal): Promise<Map<number, string>> {
  if (itemsById) return itemsById
  if (!itemsInflight) {
    itemsInflight = (async () => {
      const res = await fetchRetry(`${API}/constants/items`)
      if (!res.ok) return new Map()
      const data = (await res.json()) as Record<string, { id?: number }>
      const map = new Map<number, string>()
      for (const [key, val] of Object.entries(data)) {
        if (val?.id != null) map.set(val.id, key)
      }
      itemsById = map
      return map
    })().finally(() => {
      itemsInflight = null
    })
  }
  const map = await itemsInflight
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return map
}

export function getHero(id: number): HeroMeta | undefined {
  return heroesById?.get(id)
}

export function heroImageUrl(hero: HeroMeta | undefined): string {
  if (!hero) return ''
  const slug = hero.name.replace('npc_dota_hero_', '')
  return `${CDN}/${slug}.png`
}

function synthesizeSeries(
  minutes: number,
  perMin: number,
  endValue?: number,
): number[] {
  const end = Math.max(0, endValue ?? Math.round(perMin * minutes))
  if (minutes <= 0) return [0]
  const out: number[] = []
  for (let m = 0; m <= minutes; m++) {
    const t = m / minutes
    const eased = t * (0.75 + 0.25 * t)
    out.push(Math.round(end * eased))
  }
  return out
}

function slotIds(p: OpenDotaMatch['players'][number]): number[] {
  return [
    p.item_0,
    p.item_1,
    p.item_2,
    p.item_3,
    p.item_4,
    p.item_5,
    p.backpack_0,
    p.backpack_1,
    p.backpack_2,
    p.item_neutral,
  ].filter((x): x is number => typeof x === 'number' && x > 0)
}

function toPlayers(
  raw: OpenDotaMatch,
  itemIndex: Map<number, string>,
): MatchPlayer[] {
  const minutes = Math.max(1, Math.floor((raw.duration ?? 0) / 60))
  return raw.players.map((p) => {
    const isRadiant = p.player_slot < 128
    let gold_t = p.gold_t
    let xp_t = p.xp_t
    if (!gold_t?.length) {
      gold_t = synthesizeSeries(minutes, p.gold_per_min || 0, p.net_worth)
    }
    if (!xp_t?.length) {
      xp_t = expectedSeries(minutes, p.xp_per_min || 0)
    }
    const slotItems = slotIds(p)
      .map((id) => itemIndex.get(id))
      .filter((k): k is string => !!k)
    return {
      account_id: p.account_id,
      personaname: p.personaname,
      hero_id: p.hero_id,
      player_slot: p.player_slot,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      gold_per_min: p.gold_per_min,
      xp_per_min: p.xp_per_min,
      level: p.level,
      net_worth: p.net_worth,
      gold_t,
      xp_t,
      purchase_log: p.purchase_log,
      slotItems,
      kills_log: p.kills_log,
      lane_role: p.lane_role,
      rank_tier: p.rank_tier,
      hero_damage: p.hero_damage,
      tower_damage: p.tower_damage,
      isRadiant,
      win: isRadiant ? raw.radiant_win : !raw.radiant_win,
    }
  })
}

export { itemIconUrl } from '../data/items'

function unwrapAbortReason(err: unknown): unknown {
  if (!isAbortError(err)) return err
  if (typeof err === 'object' && err && 'cause' in err && (err as { cause?: unknown }).cause) {
    return (err as { cause: unknown }).cause
  }
  return err
}

async function fetchRetry(
  url: string,
  init?: RequestInit,
  retries = 3,
): Promise<Response> {
  let last: unknown
  for (let i = 0; i < retries; i++) {
    if (init?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const merged = mergeSignal(init?.signal ?? undefined)
    try {
      const res = await fetch(url, { ...init, signal: merged.signal })
      if ((res.status === 429 || res.status >= 500) && i < retries - 1) {
        await sleep(700 * (i + 1), init?.signal ?? undefined)
        continue
      }
      return res
    } catch (err) {
      const reason =
        merged.signal.reason instanceof Error
          ? merged.signal.reason
          : unwrapAbortReason(err)
      last = reason
      if (init?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      const timedOut =
        reason instanceof FetchTimeoutError ||
        (reason instanceof Error && reason.name === 'TimeoutError')
      if (timedOut) {
        if (i >= retries - 1) {
          throw new FetchTimeoutError()
        }
        await sleep(600 * (i + 1), init?.signal ?? undefined)
        continue
      }
      if (i >= retries - 1) throw reason instanceof Error ? reason : err
      await sleep(500 * (i + 1), init?.signal ?? undefined)
    } finally {
      merged.cleanup()
    }
  }
  throw last instanceof Error ? last : new Error('Failed to fetch')
}

export async function requestParse(
  matchId: number,
  signal?: AbortSignal,
): Promise<void> {
  await fetchRetry(
    `${API}/request/${matchId}`,
    { method: 'POST', signal },
    2,
  ).catch(() => undefined)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = window.setTimeout(() => resolve(), ms)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

function bareIncomplete(m: OpenDotaMatch): boolean {
  return (
    !m.duration ||
    !m.players?.length ||
    m.players.every((p) => !p.hero_id) ||
    m.players.every((p) => !p.gold_per_min && !p.kills && !p.deaths)
  )
}

function timelineMissing(m: OpenDotaMatch): boolean {
  return m.players.some((p) => !p.gold_t?.length)
}

export function isParseIncomplete(m: OpenDotaMatch): boolean {
  const noFights = !(m.teamfights && m.teamfights.length > 0)
  const noPurchases = m.players.every((p) => !(p.purchase_log && p.purchase_log.length))
  const noCurves = timelineMissing(m)
  return noFights || noPurchases || noCurves
}

async function fetchMatchOpenDota(
  matchId: number,
  signal?: AbortSignal,
): Promise<OpenDotaMatch> {
  // Быстрее сдаёмся → чтобы успеть уйти на proxy/Steam/кэш
  const res = await fetchRetry(`${API}/matches/${matchId}`, { signal }, 2)
  if (res.status === 404) throw new Error('Матч не найден. Проверь Match ID.')
  if (!res.ok) throw new Error(`OpenDota ошибка: ${res.status}`)
  let data = (await res.json()) as OpenDotaMatch

  if (bareIncomplete(data)) {
    await requestParse(matchId, signal)
    for (let i = 0; i < 4; i++) {
      await sleep(900, signal)
      const again = await fetchRetry(`${API}/matches/${matchId}`, { signal }, 2)
      if (!again.ok) continue
      const next = (await again.json()) as OpenDotaMatch
      data = next
      if (!bareIncomplete(next)) break
    }
  } else if (isParseIncomplete(data)) {
    void requestParse(matchId)
  }

  if (bareIncomplete(data)) {
    throw new Error(
      'Матч ещё без данных в OpenDota. Подожди пару минут и нажми анализировать снова.',
    )
  }
  return data
}

async function fetchMatchProxy(
  matchId: number,
  signal?: AbortSignal,
): Promise<{ match: OpenDotaMatch; source: MatchDataSource }> {
  const base = matchProxyBase()
  if (!base) throw new Error('proxy not configured')
  const res = await fetchRetry(`${base}/match/${matchId}`, { signal }, 2)
  if (!res.ok) throw new Error(`proxy ${res.status}`)
  const data = (await res.json()) as OpenDotaMatch & {
    _ruiner_source?: string
    error?: string
  }
  if (data.error || bareIncomplete(data)) {
    throw new Error(data.error || 'proxy empty')
  }
  const src = data._ruiner_source === 'steam' ? 'steam' : 'proxy'
  return { match: data, source: src }
}

async function fetchMatchSteam(
  matchId: number,
  signal?: AbortSignal,
): Promise<OpenDotaMatch> {
  const key = steamApiKey()
  if (!key) throw new Error('steam key missing')
  const target = steamDetailsUrl(matchId, key)
  let last: unknown
  for (const wrap of STEAM_CORS_PROXIES) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const res = await fetchRetry(wrap(target), { signal }, 2)
      if (!res.ok) throw new Error(`steam proxy ${res.status}`)
      const mapped = steamToOpenDota(await res.json(), matchId)
      if (!mapped || bareIncomplete(mapped)) throw new Error('steam empty')
      return mapped
    } catch (err) {
      last = err
      if (isAbortError(err) || signal?.aborted) throw err
    }
  }
  throw last instanceof Error ? last : new Error('Steam недоступен')
}

export async function fetchMatch(
  matchId: number,
  signal?: AbortSignal,
): Promise<{
  match: OpenDotaMatch
  players: MatchPlayer[]
  source: MatchDataSource
}> {
  await Promise.all([fetchHeroes(signal), fetchItemIndex(signal)])

  const errors: string[] = []

  try {
    const data = await fetchMatchOpenDota(matchId, signal)
    void writeMatchCache(matchId, data, 'opendota')
    return {
      match: data,
      players: toPlayers(data, itemsById ?? new Map()),
      source: 'opendota',
    }
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw err
    errors.push(err instanceof Error ? err.message : 'OpenDota')
  }

  // Сначала кэш — история открывается, даже если API лежит
  const cached = await readMatchCache(matchId)
  if (cached && !bareIncomplete(cached.match)) {
    return {
      match: cached.match,
      players: toPlayers(cached.match, itemsById ?? new Map()),
      source: 'cache',
    }
  }

  try {
    const proxied = await fetchMatchProxy(matchId, signal)
    void writeMatchCache(matchId, proxied.match, proxied.source)
    return {
      match: proxied.match,
      players: toPlayers(proxied.match, itemsById ?? new Map()),
      source: proxied.source,
    }
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw err
    if (!(err instanceof Error && /proxy not configured/.test(err.message))) {
      errors.push(err instanceof Error ? err.message : 'proxy')
    }
  }

  try {
    const data = await fetchMatchSteam(matchId, signal)
    void writeMatchCache(matchId, data, 'steam')
    return {
      match: data,
      players: toPlayers(data, itemsById ?? new Map()),
      source: 'steam',
    }
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw err
    if (!(err instanceof Error && /steam key missing/.test(err.message))) {
      errors.push(err instanceof Error ? err.message : 'Steam')
    }
  }

  throw new Error(
    errors.length
      ? `Не удалось загрузить матч (${errors.slice(0, 2).join('; ')}). OpenDota сейчас нестабильна — попробуй позже.`
      : 'Не удалось загрузить матч. Попробуй позже.',
  )
}

export function formatMatchError(err: unknown): string {
  const reason = unwrapAbortReason(err)
  if (
    reason instanceof FetchTimeoutError ||
    (reason instanceof Error && reason.name === 'TimeoutError') ||
    (reason instanceof Error && /timeout/i.test(reason.message))
  ) {
    return 'OpenDota не ответила вовремя. Попробуй ещё раз.'
  }
  if (isAbortError(reason) || isAbortError(err)) {
    return 'Поиск остановлен'
  }
  if (reason instanceof Error) {
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(reason.message)) {
      return 'Нет ответа от источников матча. Обнови страницу и попробуй ещё раз.'
    }
    return reason.message
  }
  return 'Неизвестная ошибка загрузки матча'
}

export async function fetchMatchQuick(
  matchId: number,
  signal?: AbortSignal,
): Promise<{ match: OpenDotaMatch; players: MatchPlayer[] } | null> {
  await Promise.all([fetchHeroes(signal), fetchItemIndex(signal)])
  const res = await fetchRetry(`${API}/matches/${matchId}`, { signal }, 2)
  if (!res.ok) return null
  const data = (await res.json()) as OpenDotaMatch
  if (bareIncomplete(data)) return null
  return { match: data, players: toPlayers(data, itemsById ?? new Map()) }
}

function ruinerFromMatch(data: OpenDotaMatch, matchId: number) {
  if (!data.players?.some((p) => p.hero_id)) return null
  const players = data.players.map((p) => {
    const isRadiant = p.player_slot < 128
    const win = isRadiant ? data.radiant_win : !data.radiant_win
    return { ...p, isRadiant, win }
  })
  const losers = players.filter((p) => !p.win)
  const pool = losers.length ? losers : players
  const ruiner = [...pool].sort((a, b) => {
    const ka = (a.kills + a.assists) / Math.max(1, a.deaths)
    const kb = (b.kills + b.assists) / Math.max(1, b.deaths)
    if (ka !== kb) return ka - kb
    return (a.gold_per_min ?? 0) - (b.gold_per_min ?? 0)
  })[0]
  if (!ruiner) return null
  const hero = getHero(ruiner.hero_id)
  return {
    matchId,
    heroId: ruiner.hero_id,
    heroName: hero?.localized_name ?? `Hero ${ruiner.hero_id}`,
    heroImage: heroImageUrl(hero),
    displayName: ruiner.personaname?.trim() || 'Anonymous',
  }
}

export async function peekHistoryRuiner(
  matchId: number,
  signal?: AbortSignal,
): Promise<{
  matchId: number
  heroId: number
  heroName: string
  heroImage: string
  displayName: string
} | null> {
  await fetchHeroes(signal)

  const cached = await readMatchCache(matchId)
  if (cached) {
    const fromCache = ruinerFromMatch(cached.match, matchId)
    if (fromCache) return fromCache
  }

  try {
    const res = await fetchRetry(`${API}/matches/${matchId}`, { signal }, 2)
    if (!res.ok) return null
    const data = (await res.json()) as OpenDotaMatch
    return ruinerFromMatch(data, matchId)
  } catch {
    return null
  }
}
