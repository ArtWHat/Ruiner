import type { OpenDotaMatch } from '../types'

/** Ответ Steam GetMatchDetails (упрощённо). */
type SteamMatchDetails = {
  result?: {
    match_id?: number
    duration?: number
    radiant_win?: boolean | number
    game_mode?: number
    lobby_type?: number
    players?: Array<{
      account_id?: number
      player_slot: number
      hero_id: number
      kills?: number
      deaths?: number
      assists?: number
      gold_per_min?: number
      xp_per_min?: number
      level?: number
      net_worth?: number
      hero_damage?: number
      tower_damage?: number
      personaname?: string
      item_0?: number
      item_1?: number
      item_2?: number
      item_3?: number
      item_4?: number
      item_5?: number
      backpack_0?: number
      backpack_1?: number
      backpack_2?: number
      item_neutral?: number
    }>
  }
}

/** Базовый матч без parse (нет драк / purchase_log / кривых). */
export function steamToOpenDota(raw: SteamMatchDetails, matchId: number): OpenDotaMatch | null {
  const r = raw.result
  if (!r?.players?.length || !r.duration) return null
  return {
    match_id: r.match_id ?? matchId,
    duration: r.duration,
    radiant_win: Boolean(r.radiant_win),
    game_mode: r.game_mode,
    lobby_type: r.lobby_type,
    teamfights: [],
    radiant_gold_adv: [],
    radiant_xp_adv: [],
    players: r.players.map((p) => ({
      account_id: p.account_id,
      personaname: p.personaname,
      hero_id: p.hero_id,
      player_slot: p.player_slot,
      kills: p.kills ?? 0,
      deaths: p.deaths ?? 0,
      assists: p.assists ?? 0,
      gold_per_min: p.gold_per_min ?? 0,
      xp_per_min: p.xp_per_min ?? 0,
      level: p.level ?? 1,
      net_worth: p.net_worth,
      hero_damage: p.hero_damage,
      tower_damage: p.tower_damage,
      item_0: p.item_0,
      item_1: p.item_1,
      item_2: p.item_2,
      item_3: p.item_3,
      item_4: p.item_4,
      item_5: p.item_5,
      backpack_0: p.backpack_0,
      backpack_1: p.backpack_1,
      backpack_2: p.backpack_2,
      item_neutral: p.item_neutral,
    })),
  }
}

export function steamDetailsUrl(matchId: number, key: string): string {
  const u = new URL(
    'https://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/v1/',
  )
  u.searchParams.set('key', key)
  u.searchParams.set('match_id', String(matchId))
  u.searchParams.set('include_persona_names', '1')
  return u.toString()
}
