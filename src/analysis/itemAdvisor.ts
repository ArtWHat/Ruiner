import { HERO_ITEM_TARGETS, itemLabel } from '../data/items'
import { ROLE_ITEM_TARGETS } from '../data/expectations'
import type { MatchPlayer, Role } from '../types'

const MAGIC_HEROES = new Set([
  5, 15, 17, 20, 21, 22, 25, 26, 31, 34, 37, 39, 43, 45, 52, 58, 64, 65, 68, 87,
  90, 101, 110, 111, 121, 128,
])
const EVASION_HEROES = new Set([44, 48, 62, 70, 94]) // PA, Luna, Bounty, Ursa, Medusa-ish
const ILLUSION_HEROES = new Set([12, 53, 72, 80, 81, 89]) // PL, Nature, Gyro? CK, TB, Naga, Chaos, Spectre-ish

function enemyKeys(enemies: MatchPlayer[]): Set<string> {
  const keys = new Set<string>()
  for (const e of enemies) {
    for (const p of e.purchase_log ?? []) {
      if (p.time >= 0) keys.add(p.key)
    }
    for (const key of e.slotItems ?? []) keys.add(key)
  }
  return keys
}

function hasAny(keys: Set<string>, list: string[]): boolean {
  return list.some((k) => keys.has(k))
}

/** Цель: база по герою + контр-предметы под врагов, с таймингами до конца матча. */
export function adviseItemTargets(
  heroId: number,
  role: Role,
  self: MatchPlayer,
  enemies: MatchPlayer[],
  durationMin: number,
): Array<{ key: string; minute: number; label: string; why?: string }> {
  const base =
    HERO_ITEM_TARGETS[heroId]?.map((t) => ({
      ...t,
      label: itemLabel(t.key),
      why: 'базовый ориентир по герою',
    })) ??
    ROLE_ITEM_TARGETS[role].map((t) => ({
      ...t,
      why: 'ориентир по роли',
    }))

  const keys = enemyKeys(enemies)
  const enemyHeroes = enemies.map((e) => e.hero_id)
  const out = [...base]
  const have = new Set(out.map((x) => x.key))

  const add = (key: string, minute: number, why: string) => {
    if (have.has(key)) return
    if (minute > durationMin + 2) return
    have.add(key)
    out.push({ key, minute, label: itemLabel(key), why })
  }

  const magicThreat =
    enemyHeroes.some((id) => MAGIC_HEROES.has(id)) ||
    hasAny(keys, ['sheepstick', 'orchid', 'bloodthorn', 'ethereal_blade', 'dagon_5', 'dagon'])

  const missThreat =
    hasAny(keys, ['radiance', 'butterfly']) ||
    enemyHeroes.some((id) => EVASION_HEROES.has(id))

  const illusionThreat =
    enemyHeroes.some((id) => ILLUSION_HEROES.has(id)) ||
    hasAny(keys, ['manta', 'illusion_rune'])

  const tanky =
    hasAny(keys, ['heart', 'assault', 'shivas_guard', 'black_king_bar', 'satanic'])

  // Контры
  if (missThreat && (role === 'carry' || role === 'mid' || role === 'offlane')) {
    add('monkey_king_bar', Math.min(28, Math.max(20, durationMin - 15)), 'против промахов / Radiance / evasion')
  }
  if (magicThreat) {
    if (role === 'soft' || role === 'hard' || heroId === 110 || heroId === 26) {
      add('lotus_orb', Math.min(26, Math.max(18, durationMin - 18)), 'против магии и таргета')
      add('pipe', Math.min(22, Math.max(16, durationMin - 22)), 'командная защита от магии')
    } else if (role === 'mid' || role === 'carry') {
      add('black_king_bar', Math.min(25, Math.max(18, durationMin - 16)), 'против контроля и бурста')
    }
  }
  if (illusionThreat && (role === 'carry' || role === 'mid')) {
    add('bfury', Math.min(18, Math.max(14, durationMin - 25)), 'пил иллюзии / крипов')
    add('mjollnir', Math.min(30, Math.max(22, durationMin - 12)), 'против иллюзий')
  }
  if (tanky && role === 'carry') {
    add('silver_edge', Math.min(32, Math.max(24, durationMin - 10)), 'лом пассивок танков')
    add('black_king_bar', Math.min(26, Math.max(20, durationMin - 14)), 'чтобы добить в драках')
  }

  // Добиваем пустоту поздней игры
  const late = Math.max(...out.map((x) => x.minute), 20)
  if (durationMin - late > 8) {
    if (role === 'carry') {
      add('satanic', Math.min(durationMin - 2, late + 8), 'чтобы жить в поздних драках')
      add('abyssal_blade', Math.min(durationMin - 1, late + 10), 'контроль керри врага')
    } else if (role === 'mid') {
      add('sheepstick', Math.min(durationMin - 2, late + 7), 'контроль в поздней')
      add('aghanims_shard', Math.min(22, late + 4), 'сила ульты')
    } else if (role === 'offlane') {
      add('crimson_guard', Math.min(durationMin - 4, late + 6), 'сейв команды')
      add('lotus_orb', Math.min(durationMin - 3, late + 8), 'рефлект / сейв')
    } else {
      add('force_staff', Math.min(durationMin - 5, late + 5), 'сейв и мобильность')
      add('glimmer_cape', Math.min(durationMin - 4, late + 6), 'сейв керри')
      add('lotus_orb', Math.min(durationMin - 2, late + 8), 'против магии')
    }
  }

  // Не советуем то, что уже собрано сильно раньше цели без смысла — ок оставить как ориентир
  void self

  return out
    .sort((a, b) => a.minute - b.minute)
    .slice(0, 8)
}
