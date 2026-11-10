/**
 * Cloudflare Worker: OpenDota → Steam fallback.
 *
 * Secrets: STEAM_API_KEY (https://steamcommunity.com/dev/apikey)
 * Route example: https://ruiner-match.<you>.workers.dev/match/:id
 *
 * Deploy:
 *   npx wrangler secret put STEAM_API_KEY
 *   npx wrangler deploy
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function steamToOpenDota(raw, matchId) {
  const r = raw?.result
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
    _ruiner_source: 'steam',
  }
}

async function fetchOpenDota(matchId, signal) {
  const res = await fetch(`https://api.opendota.com/api/matches/${matchId}`, {
    signal,
  })
  if (!res.ok) throw new Error(`opendota ${res.status}`)
  const data = await res.json()
  if (!data?.players?.length) throw new Error('opendota empty')
  data._ruiner_source = 'opendota'
  return data
}

async function fetchSteam(matchId, key, signal) {
  const u = new URL(
    'https://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/v1/',
  )
  u.searchParams.set('key', key)
  u.searchParams.set('match_id', String(matchId))
  u.searchParams.set('include_persona_names', '1')
  const res = await fetch(u, { signal })
  if (!res.ok) throw new Error(`steam ${res.status}`)
  const mapped = steamToOpenDota(await res.json(), matchId)
  if (!mapped) throw new Error('steam empty')
  return mapped
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    const url = new URL(request.url)
    const m = url.pathname.match(/\/match\/(\d+)\/?$/)
    if (!m) {
      return json(
        {
          ok: true,
          usage: '/match/:matchId',
          sources: ['opendota', 'steam'],
        },
        200,
      )
    }

    const matchId = Number(m[1])
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 14000)

    try {
      try {
        const data = await fetchOpenDota(
          matchId,
          AbortSignal.any([ac.signal, AbortSignal.timeout(9000)]),
        )
        return json(data)
      } catch {
        if (!env.STEAM_API_KEY) {
          return json(
            { error: 'OpenDota недоступна, STEAM_API_KEY не задан' },
            502,
          )
        }
        const data = await fetchSteam(matchId, env.STEAM_API_KEY, ac.signal)
        return json(data)
      }
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : 'upstream failed' },
        502,
      )
    } finally {
      clearTimeout(timer)
    }
  },
}
