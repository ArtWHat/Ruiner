import { adviseItemTargets } from './itemAdvisor'
import { reviewBuild } from './buildReview'
import { supportVisionNotes } from './supportVision'
import { getHero, heroImageUrl, isParseIncomplete } from '../api/opendota'
import {
  ROLE_BASELINE,
  expectedSeries,
  inferRole,
  itemLabel,
  padSeries,
} from '../data/expectations'
import { isTurbo, matchTypeLabel } from '../data/lobbies'
import { isMajorItem } from '../data/items'
import type {
  Grade,
  ImpactEvent,
  MatchAnalysis,
  MatchPlayer,
  OpenDotaMatch,
  PlayerAnalysis,
  SummaryBit,
  Teamfight,
  Tone,
} from '../types'

function displayName(p: MatchPlayer): string {
  if (p.personaname?.trim()) return p.personaname.trim()
  return 'Anonymous'
}

/** 100% = норма роли. <50 плохо, 50–79 средне, ≥80 хорошо (80–90 тоже хорошо). */
function gradeFromImpact(pct: number): Grade {
  if (pct < 50) return 'плохо'
  if (pct >= 80) return 'хорошо'
  return 'средне'
}

function toneDeaths(deaths: number): Tone {
  if (deaths <= 4) return 'good'
  if (deaths >= 10) return 'bad'
  return 'mid'
}

function toneDelta(delta: number): Tone {
  if (delta >= 0.08) return 'good'
  if (delta <= -0.12) return 'bad'
  return 'mid'
}

function playerIndex(slot: number): number {
  return slot < 128 ? slot : slot - 128 + 5
}

function buildImpactEvents(
  p: MatchPlayer,
  teamfights: Teamfight[] | undefined,
  durationSec: number,
): ImpactEvent[] {
  const events: ImpactEvent[] = []
  const idx = playerIndex(p.player_slot)

  for (const tf of teamfights ?? []) {
    const me = tf.players?.[idx]
    if (!me) continue
    const minute = Math.max(0, Math.round(tf.start / 60))
    const died = (me.deaths ?? 0) > 0
    const dmg = me.damage ?? 0
    const gold = me.gold_delta ?? 0
    const participated = died || dmg > 400 || Math.abs(gold) > 80
    if (!participated) continue

    let tone: Tone = 'mid'
    let title = `Драка ~${minute} мин`
    let detail = `Урон ${dmg}`
    if (died && dmg < 800) {
      tone = 'bad'
      detail = `Умер, слабый импакт (урон ${dmg}, золото ${gold})`
    } else if (died && dmg >= 1500) {
      tone = 'mid'
      detail = `Умер, но нанёс урон ${dmg}`
    } else if (!died && dmg >= 2000) {
      tone = 'good'
      detail = `Сильный импакт без смерти (урон ${dmg}, золото ${gold})`
    } else if (!died && gold > 150) {
      tone = 'good'
      detail = `Выгодная драка (+${gold} золота, урон ${dmg})`
    } else if (gold < -200) {
      tone = 'bad'
      detail = `Потеря экономики (${gold} золота, урон ${dmg})`
    } else {
      detail = `Урон ${dmg}, золото ${gold}${died ? ', смерть' : ''}`
      tone = died ? 'bad' : dmg > 1200 ? 'good' : 'mid'
    }
    events.push({ minute, title, detail, tone })
  }

  for (const k of p.kills_log ?? []) {
    if (k.time < 0) continue
    events.push({
      minute: Math.round(k.time / 60),
      title: `Убийство ~${Math.round(k.time / 60)} мин`,
      detail: `Добил героя`,
      tone: 'good',
    })
  }

  events.sort((a, b) => a.minute - b.minute)
  if (!events.length) {
    events.push({
      minute: Math.floor(durationSec / 120),
      title: 'Мало данных по дракам',
      detail: 'OpenDota не отдала детальный лог командных драк для слота',
      tone: 'mid',
    })
  }
  return events.slice(0, 16)
}

function buildOverview(
  p: MatchPlayer,
  role: RoleLike,
  impactPct: number,
  itemLag: number,
  events: ImpactEvent[],
  minutes: number,
  enemies: MatchPlayer[],
  teamfights: Teamfight[] | undefined,
  goldActual: number[],
  heroName: string,
  itemTimeline: Array<{ key: string; minute: number; label: string }>,
): string {
  const bits: string[] = []
  const fights = events.filter((e) => e.title.startsWith('Драка'))
  const badFights = fights.filter((e) => e.tone === 'bad')
  const goodFights = fights.filter((e) => e.tone === 'good')
  const idx = playerIndex(p.player_slot)
  const kda = `${p.kills}/${p.deaths}/${p.assists}`

  if (impactPct >= 115) {
    bits.push(
      `${heroName} тащил: ${kda}, GPM ${p.gold_per_min}, импакт ${impactPct}%.`,
    )
  } else if (impactPct <= 55) {
    bits.push(
      `${heroName} просел: ${kda}, GPM ${p.gold_per_min}, импакт всего ${impactPct}%.`,
    )
  } else {
    bits.push(
      `${heroName} сыграл средне: ${kda}, GPM ${p.gold_per_min}, импакт ${impactPct}%.`,
    )
  }

  const tfList = teamfights ?? []
  let realFights = 0
  let joined = 0
  let ghost = 0
  let lowDmgDeaths = 0
  let farmInstead = 0
  let best: { minute: number; dmg: number } | null = null
  let worstDeath: { minute: number; dmg: number } | null = null

  for (const tf of tfList) {
    const me = tf.players?.[idx]
    if (!me) continue
    const teamDmg = (tf.players ?? []).reduce((s, x) => s + (x.damage ?? 0), 0)
    if (teamDmg < 2500 && !(tf.deaths?.length)) continue
    realFights += 1
    const dmg = me.damage ?? 0
    const died = (me.deaths ?? 0) > 0
    const minute = Math.max(0, Math.round(tf.start / 60))
    const startM = Math.max(0, Math.floor(tf.start / 60))
    const endM = Math.min(
      goldActual.length - 1,
      Math.max(startM + 1, Math.ceil(tf.end / 60)),
    )
    const goldGain =
      (goldActual[endM] ?? 0) - (goldActual[startM] ?? goldActual[endM] ?? 0)

    if (dmg >= 500 || died) joined += 1
    else ghost += 1
    if (died && dmg < 700) {
      lowDmgDeaths += 1
      if (!worstDeath || dmg < worstDeath.dmg) worstDeath = { minute, dmg }
    }
    if (dmg < 400 && goldGain > 250) farmInstead += 1
    if (!best || dmg > best.dmg) best = { minute, dmg }
  }

  if (best && best.dmg >= 800) {
    bits.push(`Самая жирная драка ~${best.minute} мин (урон ${best.dmg}).`)
  }
  if (worstDeath) {
    bits.push(
      `Слабая смерть ~${worstDeath.minute} мин при уроне всего ${worstDeath.dmg}.`,
    )
  } else if (ghost >= Math.max(2, Math.floor(realFights * 0.35)) && realFights >= 3) {
    bits.push(
      `Из ~${realFights} командных драк почти без импакта ушёл в ${ghost}.`,
    )
  } else if (joined >= 3 && realFights >= 3) {
    bits.push(`Отметился в ${joined} из ~${realFights} заметных драк.`)
  }

  if (farmInstead >= 2) {
    bits.push('Пару раз фармил в стороне, пока шла командная драка.')
  }

  if (badFights.length >= goodFights.length + 2 && impactPct < 100) {
    const sample = badFights[0]
    bits.push(
      sample
        ? `Чаще ошибался в драках — например, ${sample.title.toLowerCase()}: ${sample.detail}.`
        : 'В драках чаще ошибался, чем тащил.',
    )
  } else if (goodFights.length > badFights.length && goodFights.length > 0) {
    const sample = goodFights[0]
    bits.push(
      sample
        ? `В драках чаще помогал — ${sample.title.toLowerCase()}: ${sample.detail}.`
        : 'В драках чаще приносил пользу.',
    )
  }

  const keyItem = itemTimeline[0] ?? itemTimeline[1]
  if (keyItem) {
    if (impactPct < 105 && itemLag > 0.18) {
      bits.push(
        `${keyItem.label} только к ${keyItem.minute} мин — сборка опаздывала.`,
      )
    } else {
      bits.push(`${keyItem.label} в ~${keyItem.minute} мин смотрелся уместно.`)
    }
  } else if (impactPct < 105 && itemLag > 0.18) {
    bits.push('Крупные предметы выходили поздновато.')
  }

  if (p.deaths >= 8) {
    bits.push(`Много умирал: ${p.deaths} смертей за ${minutes} мин.`)
  } else if (p.deaths <= 3 && minutes >= 25) {
    bits.push(`Жил аккуратно: всего ${p.deaths} смертей за ${minutes} мин.`)
  }

  const hd = p.hero_damage ?? 0
  if (hd > 0) {
    bits.push(`Урон по героям ${hd} (~${Math.round(hd / minutes)}/мин).`)
  }

  bits.push(...supportVisionNotes(p, role, enemies).slice(0, 2))

  return bits.join(' ')
}

type RoleLike = import('../types').Role

/** Turbo: золото/опыт ~в 2 раза быстрее обычной. */
const TURBO_PACE = 1.9
const TURBO_ITEM_TIME = 0.52

function analyzePlayer(
  p: MatchPlayer,
  durationSec: number,
  all: MatchPlayer[],
  teamfights: Teamfight[] | undefined,
  turbo: boolean,
): PlayerAnalysis {
  const minutes = Math.max(1, Math.floor(durationSec / 60))
  const hero = getHero(p.hero_id)
  const role = inferRole(p.lane_role, p.player_slot, hero?.roles, p.gold_per_min)
  const base = ROLE_BASELINE[role]
  const pace = turbo ? TURBO_PACE : 1
  const baseline = {
    gpm: Math.round(base.gpm * pace),
    xpm: Math.round(base.xpm * pace),
  }
  const enemies = all.filter((x) => x.isRadiant !== p.isRadiant)

  const goldActual = padSeries(p.gold_t, minutes)
  const xpActual = padSeries(p.xp_t, minutes)
  const goldExpected = expectedSeries(minutes, baseline.gpm)
  const xpExpected = expectedSeries(minutes, baseline.xpm)

  const gpmDelta = (p.gold_per_min - baseline.gpm) / baseline.gpm
  const xpmDelta = (p.xp_per_min - baseline.xpm) / baseline.xpm
  const kda = (p.kills + p.assists) / Math.max(1, p.deaths)
  const kdaDelta = (kda - 2.2) / 2.2
  // в турбо смерти бьют по темпу сильнее относительно короткой игры
  const deathPenalty = Math.min(1, p.deaths / (turbo ? 9 : 12))

  let score =
    gpmDelta * 0.35 + xpmDelta * 0.25 + kdaDelta * 0.25 - deathPenalty * 0.35

  const mid = Math.floor(minutes * 0.55)
  if (goldActual[mid] && goldExpected[mid]) {
    const midGap =
      (goldActual[mid] - goldExpected[mid]) / Math.max(1, goldExpected[mid])
    score += midGap * 0.2
  }

  const targets = adviseItemTargets(p.hero_id, role, p, enemies, minutes).map(
    (t) => ({
      ...t,
      minute: turbo
        ? Math.max(1, Math.round(t.minute * TURBO_ITEM_TIME))
        : t.minute,
    }),
  )
  const purchases = p.purchase_log ?? []

  const seen = new Set<string>()
  let itemTimeline = purchases
    .filter(
      (x) =>
        x.time >= 0 &&
        isMajorItem(x.key) &&
        !seen.has(x.key) &&
        (seen.add(x.key), true),
    )
    .map((x) => ({
      key: x.key,
      minute: Math.round(x.time / 60),
      label: itemLabel(x.key),
    }))
    .sort((a, b) => a.minute - b.minute)
    .slice(0, 14)

  // OpenDota ещё без purchase_log — берём финальные слоты (время неизвестно).
  if (!itemTimeline.length && p.slotItems?.length) {
    const slotSeen = new Set<string>()
    itemTimeline = p.slotItems
      .filter((key) => isMajorItem(key) && !slotSeen.has(key) && (slotSeen.add(key), true))
      .map((key) => ({
        key,
        minute: minutes,
        label: itemLabel(key),
      }))
      .slice(0, 14)
  }

  const itemFacts = targets
    .map((t) => {
      const hit = purchases.find(
        (x) =>
          x.time >= 0 &&
          (x.key === t.key ||
            (t.key === 'bfury' && x.key === 'battle_fury') ||
            (t.key === 'battle_fury' && x.key === 'bfury')),
      )
      if (!hit) return null
      return {
        key: t.key,
        minute: Math.round(hit.time / 60),
        label: itemLabel(t.key),
      }
    })
    .filter(Boolean) as PlayerAnalysis['itemFacts']

  let itemLag = 0
  for (const t of targets.slice(0, 5)) {
    const hit = purchases.find((x) => x.key === t.key && x.time >= 0)
    if (!hit) {
      itemLag += 0.08
      continue
    }
    const actualMin = hit.time / 60
    if (actualMin > t.minute + 4) itemLag += 0.06
    else if (actualMin <= t.minute) score += 0.03
  }
  score -= itemLag

  // 100% = норма по роли; >100% — сильнее ожидания
  const impactPct = Math.max(
    8,
    Math.min(220, Math.round(100 + score * 100)),
  )

  const goldLostOnDeaths = p.deaths * (turbo ? 420 : 280)
  const impactEvents = buildImpactEvents(p, teamfights, durationSec)
  const heroName = hero?.localized_name ?? `Hero ${p.hero_id}`
  const overview = buildOverview(
    p,
    role,
    impactPct,
    itemLag,
    impactEvents,
    minutes,
    enemies,
    teamfights,
    goldActual,
    heroName,
    itemTimeline,
  )

  const reasons: string[] = []
  if (gpmDelta < -0.15)
    reasons.push(`GPM ниже ориентира роли (${baseline.gpm})`)
  if (xpmDelta < -0.15)
    reasons.push(`XPM ниже ориентира роли (${baseline.xpm})`)
  if (p.deaths >= 8) reasons.push(`Много смертей: ${p.deaths}`)
  if (itemLag > 0.1) reasons.push('Ключевые предметы позже ориентира')

  const summary: SummaryBit[] = [
    { text: `Смерти: ${p.deaths}`, tone: toneDeaths(p.deaths) },
    {
      text: `Потеря золота от смертей ≈ ${goldLostOnDeaths}`,
      tone:
        goldLostOnDeaths >= 2800
          ? 'bad'
          : goldLostOnDeaths <= 1200
            ? 'good'
            : 'mid',
    },
    {
      text: `GPM ${p.gold_per_min} vs ${baseline.gpm}`,
      tone: toneDelta(gpmDelta),
    },
    {
      text: `Урон по героям ${p.hero_damage ?? 0}`,
      tone:
        (p.hero_damage ?? 0) > baseline.gpm * minutes * 0.9
          ? 'good'
          : (p.hero_damage ?? 0) < baseline.gpm * minutes * 0.45
            ? 'bad'
            : 'mid',
    },
  ]

  const build = reviewBuild(p, role, enemies, itemTimeline, minutes, turbo)

  return {
    player: p,
    heroName,
    heroImage: heroImageUrl(hero),
    displayName: displayName(p),
    role,
    grade: gradeFromImpact(impactPct),
    score,
    impactPct,
    expectedGpm: baseline.gpm,
    expectedXpm: baseline.xpm,
    goldActual,
    goldExpected,
    xpActual,
    xpExpected,
    itemFacts,
    itemTargets: targets,
    itemTimeline,
    reasons,
    summary,
    impactEvents,
    goldLostOnDeaths,
    overview,
    build,
  }
}

export function analyzeMatch(
  match: OpenDotaMatch,
  players: MatchPlayer[],
  dataSource: MatchAnalysis['dataSource'] = 'opendota',
): MatchAnalysis {
  const turbo = isTurbo(match.game_mode)
  const analyzed = players.map((p) =>
    analyzePlayer(p, match.duration, players, match.teamfights, turbo),
  )
  const losers = analyzed.filter((p) => !p.player.win)
  const winners = analyzed.filter((p) => p.player.win)

  const ruiner =
    [...losers].sort((a, b) => a.impactPct - b.impactPct)[0] ?? analyzed[0]
  const mvp =
    [...winners].sort((a, b) => b.impactPct - a.impactPct)[0] ?? analyzed[0]

  return {
    matchId: match.match_id,
    duration: match.duration,
    radiantWin: match.radiant_win,
    gameMode: match.game_mode,
    lobbyType: match.lobby_type,
    matchType: matchTypeLabel(match.game_mode, match.lobby_type),
    turbo,
    parseIncomplete: isParseIncomplete(match),
    dataSource,
    players: analyzed,
    ruiner,
    mvp,
    teamfights: match.teamfights ?? [],
    radiantGoldAdv: match.radiant_gold_adv ?? [],
    radiantXpAdv: match.radiant_xp_adv ?? [],
  }
}
