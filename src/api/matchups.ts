import { getHero } from './opendota'

const API = 'https://api.opendota.com/api'

export interface HeroMatchupRow {
  hero_id: number
  games_played: number
  wins: number
}

const cache = new Map<number, HeroMatchupRow[]>()

export async function fetchHeroMatchups(heroId: number): Promise<HeroMatchupRow[]> {
  const hit = cache.get(heroId)
  if (hit) return hit
  const res = await fetch(`${API}/heroes/${heroId}/matchups`)
  if (!res.ok) return []
  const data = (await res.json()) as HeroMatchupRow[]
  cache.set(heroId, data)
  return data
}

function wr(row?: HeroMatchupRow): number | null {
  if (!row || row.games_played < 15) return null
  return (row.wins / row.games_played) * 100
}

export interface HeroFit {
  heroId: number
  name: string
  /** 0–100, насколько герой заходит в пик */
  fit: number
  tag: 'good' | 'bad' | 'mid'
}

export async function analyzeDraft(
  radiantIds: number[],
  direIds: number[],
): Promise<{
  radiant: HeroFit[]
  dire: HeroFit[]
  radiantScore: number
  direScore: number
  verdict: string
}> {
  const allIds = [...radiantIds, ...direIds]
  const tables = await Promise.all(allIds.map((id) => fetchHeroMatchups(id)))
  const byId = new Map(allIds.map((id, i) => [id, tables[i] ?? []]))

  function scoreHero(heroId: number, allies: number[], enemies: number[]): number {
    const table = byId.get(heroId) ?? []
    const vs: number[] = []
    for (const e of enemies) {
      const r = wr(table.find((x) => x.hero_id === e))
      if (r !== null) vs.push(r)
    }
    // «синергия» грубо: если герой хорошо против тех же, против кого сильны союзники
    const allyHelp: number[] = []
    for (const a of allies) {
      if (a === heroId) continue
      const at = byId.get(a) ?? []
      for (const e of enemies) {
        const r = wr(at.find((x) => x.hero_id === e))
        if (r !== null) allyHelp.push(r)
      }
    }
    const vsAvg = vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : 50
    const synAvg = allyHelp.length
      ? allyHelp.reduce((s, v) => s + v, 0) / allyHelp.length
      : 50
    return Math.round(vsAvg * 0.7 + synAvg * 0.3)
  }

  function pack(ids: number[], allies: number[], enemies: number[]): HeroFit[] {
    return ids.map((heroId) => {
      const fit = scoreHero(heroId, allies, enemies)
      return {
        heroId,
        name: getHero(heroId)?.localized_name ?? String(heroId),
        fit,
        tag: fit >= 54 ? 'good' : fit <= 46 ? 'bad' : 'mid',
      }
    })
  }

  const radiant = pack(radiantIds, radiantIds, direIds)
  const dire = pack(direIds, direIds, radiantIds)
  const radiantScore = Math.round(
    radiant.reduce((s, h) => s + h.fit, 0) / Math.max(1, radiant.length),
  )
  const direScore = Math.round(
    dire.reduce((s, h) => s + h.fit, 0) / Math.max(1, dire.length),
  )
  const diff = radiantScore - direScore
  let verdict = 'Драфты близки по силе'
  if (diff >= 4) verdict = `Драфт Света сильнее примерно на ${diff}%`
  else if (diff <= -4) verdict = `Драфт Тьмы сильнее примерно на ${Math.abs(diff)}%`

  return { radiant, dire, radiantScore, direScore, verdict }
}
