import { itemLabel } from '../data/items'
import { countVision, enemyHasInvis } from './supportVision'
import type { MatchPlayer, Role, Tone } from '../types'

export interface BuildItemRow {
  key: string
  label: string
  minute: number
  timingTone: Tone
  timingNote: string
}

export interface BuildPoint {
  tone: 'good' | 'bad'
  text: string
  itemKey?: string
}

export interface BuildReview {
  score: number
  summary: string
  items: BuildItemRow[]
  points: BuildPoint[]
}

const MAGIC_HEROES = new Set([
  5, 15, 17, 20, 21, 22, 25, 26, 31, 34, 37, 39, 43, 45, 52, 58, 64, 65, 68, 87,
  90, 101, 105, 110, 111, 121, 128, // 105 Techies
])

const MAGIC_ITEMS = [
  'aether_lens',
  'veil_of_discord',
  'ethereal_blade',
  'sheepstick',
  'octarine_core',
  'kaya',
  'yasha_and_kaya',
  'kaya_and_sange',
  'ultimate_scepter',
  'dagon_5',
  'dagon',
  'rod_of_atos',
  'gleipnir',
  'phylactery',
  'bloodstone',
  'shivas_guard',
  'refresher',
  'wind_waker',
  'force_staff',
  'glimmer_cape',
]

const PHYS_CORE = [
  'desolator',
  'daedalus',
  'greater_crit',
  'butterfly',
  'abyssal_blade',
  'monkey_king_bar',
  'satanic',
  'rapier',
  'bfury',
  'battle_fury',
  'maelstrom',
  'mjollnir',
]
const INVIS_HEROES = new Set([9, 32, 62, 80, 88, 93]) // Mirana, Riki, BH, Lone, Nyx, etc.
const EVASION_HEROES = new Set([44, 48, 62, 70, 94])

const IDEAL: Record<string, number> = {
  power_treads: 8,
  phase_boots: 8,
  arcane_boots: 10,
  tranquil_boots: 8,
  travel_boots: 22,
  bfury: 16,
  battle_fury: 16,
  manta: 22,
  black_king_bar: 24,
  desolator: 20,
  blink: 14,
  force_staff: 18,
  glimmer_cape: 18,
  aether_lens: 20,
  sheepstick: 30,
  monkey_king_bar: 26,
  lotus_orb: 24,
  pipe: 20,
  radiance: 20,
  satanic: 35,
  abyssal_blade: 36,
  greater_crit: 34,
  rapier: 40,
  shivas_guard: 28,
  assault: 26,
  spirit_vessel: 18,
  urn_of_shadows: 12,
  rod_of_atos: 16,
  maelstrom: 18,
  mjollnir: 26,
  orchid: 18,
  bloodthorn: 28,
  ultimate_scepter: 25,
  aghanims_shard: 20,
  solar_crest: 22,
  magic_wand: 5,
  bottle: 3,
  null_talisman: 3,
}

function enemyItemKeys(enemies: MatchPlayer[]): Set<string> {
  const s = new Set<string>()
  for (const e of enemies) {
    for (const p of e.purchase_log ?? []) {
      if (p.time >= 0) s.add(p.key)
    }
  }
  return s
}

function owned(keys: Set<string>, list: string[]): boolean {
  return list.some((k) => keys.has(k))
}

function heroLooksLikeFarmCarry(heroId: number): boolean {
  return [44, 1, 11, 12, 46, 48, 70, 94, 109].includes(heroId)
}

function timingFor(key: string, minute: number): Pick<BuildItemRow, 'timingTone' | 'timingNote'> {
  const ideal = IDEAL[key]
  if (ideal === undefined) {
    return { timingTone: 'mid', timingNote: 'без жёсткого ориентира' }
  }
  const diff = minute - ideal
  if (diff <= 1) return { timingTone: 'good', timingNote: `рано/в срок (цель ~${ideal}м)` }
  if (diff <= 4) return { timingTone: 'mid', timingNote: `чуть позже (цель ~${ideal}м)` }
  return { timingTone: 'bad', timingNote: `поздно на ${diff}м (цель ~${ideal}м)` }
}

export function reviewBuild(
  self: MatchPlayer,
  role: Role,
  enemies: MatchPlayer[],
  itemTimeline: Array<{ key: string; minute: number; label: string }>,
  durationMin: number,
): BuildReview {
  const bought = new Set(itemTimeline.map((i) => i.key))
  // also raw purchase keys
  for (const p of self.purchase_log ?? []) {
    if (p.time >= 0) bought.add(p.key)
  }

  const items: BuildItemRow[] = itemTimeline.map((i) => {
    const t = timingFor(i.key, i.minute)
    return {
      key: i.key,
      label: i.label,
      minute: i.minute,
      timingTone: t.timingTone,
      timingNote: t.timingNote,
    }
  })

  const points: BuildPoint[] = []
  const enemyKeys = enemyItemKeys(enemies)
  const enemyHeroes = enemies.map((e) => e.hero_id)
  const magic = enemyHeroes.some((id) => MAGIC_HEROES.has(id))
  const invis = enemyHeroes.some((id) => INVIS_HEROES.has(id))
  const evasion =
    enemyHeroes.some((id) => EVASION_HEROES.has(id)) || owned(enemyKeys, ['radiance', 'butterfly'])
  const physHeavy = owned(enemyKeys, ['desolator', 'assault', 'daedalus', 'greater_crit', 'monkey_king_bar'])

  // boots
  if (owned(bought, ['power_treads', 'phase_boots', 'arcane_boots', 'tranquil_boots', 'travel_boots'])) {
    const boot = ['power_treads', 'phase_boots', 'arcane_boots', 'tranquil_boots', 'travel_boots'].find((b) =>
      bought.has(b),
    )!
    points.push({
      tone: 'good',
      text: `Подходящие ботинки (${itemLabel(boot)})`,
      itemKey: boot,
    })
  } else {
    points.push({ tone: 'bad', text: 'Нет нормальных ботинок в финальном билде' })
  }

  if (owned(bought, ['bfury', 'battle_fury']) && (role === 'carry' || heroLooksLikeFarmCarry(self.hero_id))) {
    points.push({
      tone: 'good',
      text: 'Battle Fury — правильный фарм-кор для этой позиции',
      itemKey: 'bfury',
    })
  }

  if (owned(bought, ['desolator'])) {
    points.push({
      tone: 'good',
      text: 'Desolator усиливает урон по героям и строениям',
      itemKey: 'desolator',
    })
  }

  if (owned(bought, ['black_king_bar'])) {
    points.push({
      tone: 'good',
      text: 'BKB закрывает часть магии и контроля',
      itemKey: 'black_king_bar',
    })
  }

  if (evasion && owned(bought, ['monkey_king_bar'])) {
    points.push({
      tone: 'good',
      text: 'Monkey King Bar против промахов / Radiance',
      itemKey: 'monkey_king_bar',
    })
  } else if (evasion && (role === 'carry' || role === 'mid')) {
    points.push({
      tone: 'bad',
      text: 'Не собрал MKB — против Radiance/evasion много промахов',
      itemKey: 'monkey_king_bar',
    })
  }

  if (magic && owned(bought, ['black_king_bar', 'lotus_orb', 'pipe', 'hood_of_defiance', 'eternal_shroud'])) {
    const what = ['black_king_bar', 'lotus_orb', 'pipe', 'hood_of_defiance', 'eternal_shroud'].find((k) =>
      bought.has(k),
    )!
    points.push({
      tone: 'good',
      text: `${itemLabel(what)} уместен против магии врага`,
      itemKey: what,
    })
  } else if (magic) {
    if (role === 'soft' || role === 'hard') {
      points.push({
        tone: 'bad',
        text: 'Против магов не взяли Pipe / Lotus — команда горела от спеллов',
        itemKey: 'pipe',
      })
    } else if (!owned(bought, ['black_king_bar'])) {
      points.push({
        tone: 'bad',
        text: 'Уязвим к контролю/магии без BKB или Lotus',
        itemKey: 'black_king_bar',
      })
    }
  }

  if (role === 'soft' || role === 'hard') {
    const v = countVision(self)
    const wards = v.ward_observer + v.ward_sentry
    if (wards >= 4) {
      points.push({
        tone: 'good',
        text: `Варды в порядке: ${v.ward_observer} obs / ${v.ward_sentry} sentry`,
        itemKey: 'ward_observer',
      })
    } else {
      points.push({
        tone: 'bad',
        text: `Мало вардов для саппорта (${v.ward_observer} obs / ${v.ward_sentry} sentry)`,
        itemKey: 'ward_observer',
      })
    }
    if (v.smoke_of_deceit > 0) {
      points.push({
        tone: 'good',
        text: `Брал смоки (${v.smoke_of_deceit})`,
        itemKey: 'smoke_of_deceit',
      })
    }
    const needDetect = invis || enemyHasInvis(enemies)
    const detect = v.dust + v.ward_sentry + v.gem
    if (needDetect && detect === 0) {
      points.push({
        tone: 'bad',
        text: 'Против инвиза не брал dust / sentry / gem',
        itemKey: 'dust',
      })
    } else if (needDetect && detect > 0) {
      points.push({
        tone: 'good',
        text: `Детекция есть: dust ${v.dust}, gem ${v.gem}`,
        itemKey: v.gem > 0 ? 'gem' : 'dust',
      })
    }
  } else if (invis && owned(bought, ['dust', 'ward_sentry', 'gem'])) {
    points.push({ tone: 'good', text: 'Есть детекция против инвиза', itemKey: 'dust' })
  }

  if (physHeavy && owned(bought, ['assault', 'crimson_guard', 'ghost', 'ethereal_blade'])) {
    const what = ['assault', 'crimson_guard', 'ghost', 'ethereal_blade'].find((k) => bought.has(k))!
    points.push({
      tone: 'good',
      text: 'Есть ответ на физический урон врага',
      itemKey: what,
    })
  }

  const magicHero = MAGIC_HEROES.has(self.hero_id)
  const magicBuild =
    magicHero ||
    (owned(bought, MAGIC_ITEMS) && !owned(bought, PHYS_CORE))
  const physBuild = owned(bought, PHYS_CORE) && !magicHero

  if (durationMin >= 35) {
    if (magicBuild || (magicHero && !physBuild)) {
      const magicLate = [
        'sheepstick',
        'octarine_core',
        'shivas_guard',
        'refresher',
        'ultimate_scepter',
        'ethereal_blade',
        'wind_waker',
        'aether_lens',
      ]
      const missing = magicLate.filter((k) => !bought.has(k))
      if (missing.length >= 3) {
        const tip = missing.slice(0, 2).map(itemLabel).join(' / ')
        points.push({
          tone: 'bad',
          text: `В поздней не хватило магического керри-предмета (${tip})`,
          itemKey: missing[0],
        })
      }
    } else if (physBuild || role === 'carry' || role === 'mid') {
      if (
        !owned(bought, [
          'greater_crit',
          'daedalus',
          'rapier',
          'butterfly',
          'abyssal_blade',
          'satanic',
        ])
      ) {
        points.push({
          tone: 'bad',
          text: 'В поздней не хватило физ. урона (Daedalus / Abyssal / Butterfly)',
          itemKey: 'greater_crit',
        })
      }
    }
  }

  const late = items.filter((i) => i.timingTone === 'bad')
  for (const l of late.slice(0, 2)) {
    points.push({
      tone: 'bad',
      text: `${l.label} слишком поздно (${l.minute}м, ${l.timingNote})`,
      itemKey: l.key,
    })
  }

  // score
  let score = 5
  score += points.filter((p) => p.tone === 'good').length * 0.9
  score -= points.filter((p) => p.tone === 'bad').length * 1.1
  score -= late.length * 0.4
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10))
  // display as int 1-10
  const scoreInt = Math.max(1, Math.min(10, Math.round(score)))

  let summary = 'Сборный билд без явного фокуса'
  if (scoreInt >= 8) summary = 'Хороший билд, базовые нужды закрыты'
  else if (scoreInt >= 6) summary = 'Нормальный билд, есть спорные решения'
  else if (scoreInt >= 4) summary = 'Слабый билд под этот матч — много дыр'
  else summary = 'Билд плохо подходит под врагов и тайминги'

  // unique points, cap
  const uniq: BuildPoint[] = []
  const seen = new Set<string>()
  for (const p of points) {
    if (seen.has(p.text)) continue
    seen.add(p.text)
    uniq.push(p)
  }

  return {
    score: scoreInt,
    summary,
    items,
    points: uniq.slice(0, 8),
  }
}
