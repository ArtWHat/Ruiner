import type { HeroMeta, MatchPlayer, OpenDotaMatch } from '../types'

const API = 'https://api.opendota.com/api'
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes'

let heroesCache: HeroMeta[] | null = null
let heroesById: Map<number, HeroMeta> | null = null

export async function fetchHeroes(): Promise<HeroMeta[]> {
  if (heroesCache) return heroesCache
  const res = await fetch(`${API}/heroes`)
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

function toPlayers(raw: OpenDotaMatch): MatchPlayer[] {
  return raw.players.map((p) => {
    const isRadiant = p.player_slot < 128
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
      gold_t: p.gold_t,
      xp_t: p.xp_t,
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

export async function requestParse(matchId: number): Promise<void> {
  await fetch(`${API}/request/${matchId}`, { method: 'POST' }).catch(() => undefined)
}

export async function fetchMatch(matchId: number): Promise<{
  match: OpenDotaMatch
  players: MatchPlayer[]
}> {
  await fetchHeroes()
  const res = await fetch(`${API}/matches/${matchId}`)
  if (res.status === 404) throw new Error('Матч не найден. Проверь Match ID.')
  if (!res.ok) throw new Error(`OpenDota ошибка: ${res.status}`)
  let data = (await res.json()) as OpenDotaMatch

  const incomplete = (m: OpenDotaMatch) =>
    !m.duration ||
    !m.players?.length ||
    m.players.every((p) => !p.hero_id) ||
    m.players.some((p) => !p.gold_t?.length)

  if (incomplete(data)) {
    await requestParse(matchId)
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2500))
      const again = await fetch(`${API}/matches/${matchId}`)
      if (!again.ok) continue
      const next = (await again.json()) as OpenDotaMatch
      if (!incomplete(next)) {
        data = next
        break
      }
    }
  }

  if (incomplete(data)) {
    throw new Error(
      'Матч ещё без полных данных в OpenDota (нет героев/таймлайна). Подожди пару минут или возьми другой Match ID.',
    )
  }

  return { match: data, players: toPlayers(data) }
}

export function formatMatchError(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Неизвестная ошибка загрузки матча'
}
