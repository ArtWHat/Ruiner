import { expectedSeries } from '../data/expectations'
import type { HeroMeta, MatchPlayer, OpenDotaMatch } from '../types'

const API = 'https://api.opendota.com/api'
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes'

let heroesCache: HeroMeta[] | null = null
let heroesById: Map<number, HeroMeta> | null = null

export async function fetchHeroes(signal?: AbortSignal): Promise<HeroMeta[]> {
  if (heroesCache) return heroesCache
  const res = await fetch(`${API}/heroes`, { signal })
  if (!res.ok) throw new Error('Не удалось загрузить список героев')
  heroesCache = (await res.json()) as HeroMeta[]
  heroesById = new Map(heroesCache.map((h) => [h.id, h]))
  return heroesCache
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
    // чуть медленнее старт, как у реальной NW-кривой
    const eased = t * (0.75 + 0.25 * t)
    out.push(Math.round(end * eased))
  }
  return out
}

function toPlayers(raw: OpenDotaMatch): MatchPlayer[] {
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

export async function requestParse(
  matchId: number,
  signal?: AbortSignal,
): Promise<void> {
  await fetch(`${API}/request/${matchId}`, { method: 'POST', signal }).catch(
    () => undefined,
  )
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

/** Можно разбирать без таймлайна — кривые синтезируем. */
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

export async function fetchMatch(
  matchId: number,
  signal?: AbortSignal,
): Promise<{
  match: OpenDotaMatch
  players: MatchPlayer[]
}> {
  await fetchHeroes(signal)
  const res = await fetch(`${API}/matches/${matchId}`, { signal })
  if (res.status === 404) throw new Error('Матч не найден. Проверь Match ID.')
  if (!res.ok) throw new Error(`OpenDota ошибка: ${res.status}`)
  let data = (await res.json()) as OpenDotaMatch

  // Турбо / SD / обычные: просим parse, если нет героев или таймлайна
  if (bareIncomplete(data) || timelineMissing(data)) {
    await requestParse(matchId, signal)
    const tries = bareIncomplete(data) ? 12 : 6
    for (let i = 0; i < tries; i++) {
      await sleep(2000, signal)
      const again = await fetch(`${API}/matches/${matchId}`, { signal })
      if (!again.ok) continue
      const next = (await again.json()) as OpenDotaMatch
      data = next
      if (!bareIncomplete(next) && !timelineMissing(next)) break
      if (!bareIncomplete(next) && i >= 3) break // есть база — хватит, таймлайн синтезируем
    }
  }

  if (bareIncomplete(data)) {
    throw new Error(
      'Матч ещё без данных в OpenDota. Подожди пару минут или останови поиск и попробуй позже.',
    )
  }

  return { match: data, players: toPlayers(data) }
}

export function formatMatchError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Поиск остановлен'
  }
  if (err instanceof Error) return err.message
  return 'Неизвестная ошибка загрузки матча'
}

/** Быстрый снимок матча без ожидания parse — для иконок в истории. */
export async function fetchMatchQuick(
  matchId: number,
  signal?: AbortSignal,
): Promise<{ match: OpenDotaMatch; players: MatchPlayer[] } | null> {
  await fetchHeroes(signal)
  const res = await fetch(`${API}/matches/${matchId}`, { signal })
  if (!res.ok) return null
  const data = (await res.json()) as OpenDotaMatch
  if (bareIncomplete(data)) return null
  return { match: data, players: toPlayers(data) }
}

/** Карточка руинера для истории: один лёгкий запрос, без полного анализа. */
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
  const res = await fetch(`${API}/matches/${matchId}`, { signal })
  if (!res.ok) return null
  const data = (await res.json()) as OpenDotaMatch
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
