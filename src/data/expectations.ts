import type { Role } from '../types'
import { HERO_ITEM_TARGETS, itemLabel } from './items'

/** Ориентиры GPM/XPM «нормальной» игры по роли (не Dota Plus). */
export const ROLE_BASELINE: Record<Role, { gpm: number; xpm: number }> = {
  carry: { gpm: 580, xpm: 620 },
  mid: { gpm: 560, xpm: 650 },
  offlane: { gpm: 480, xpm: 560 },
  soft: { gpm: 320, xpm: 420 },
  hard: { gpm: 280, xpm: 380 },
}

/** Ключевые предметы и целевые минуты по роли (fallback). */
export const ROLE_ITEM_TARGETS: Record<
  Role,
  Array<{ key: string; minute: number; label: string }>
> = {
  carry: [
    { key: 'power_treads', minute: 8, label: 'Power Treads' },
    { key: 'bfury', minute: 16, label: 'Battle Fury' },
    { key: 'manta', minute: 22, label: 'Manta Style' },
    { key: 'black_king_bar', minute: 28, label: 'Black King Bar' },
  ],
  mid: [
    { key: 'bottle', minute: 3, label: 'Bottle' },
    { key: 'power_treads', minute: 7, label: 'Power Treads' },
    { key: 'blink', minute: 12, label: 'Blink Dagger' },
    { key: 'black_king_bar', minute: 22, label: 'Black King Bar' },
  ],
  offlane: [
    { key: 'soul_ring', minute: 6, label: 'Soul Ring' },
    { key: 'blink', minute: 14, label: 'Blink Dagger' },
    { key: 'blade_mail', minute: 18, label: 'Blade Mail' },
    { key: 'crimson_guard', minute: 24, label: 'Crimson Guard' },
  ],
  soft: [
    { key: 'arcane_boots', minute: 8, label: 'Arcane Boots' },
    { key: 'force_staff', minute: 16, label: 'Force Staff' },
    { key: 'glimmer_cape', minute: 20, label: 'Glimmer Cape' },
    { key: 'aether_lens', minute: 24, label: 'Aether Lens' },
  ],
  hard: [
    { key: 'tranquil_boots', minute: 7, label: 'Tranquil Boots' },
    { key: 'magic_wand', minute: 5, label: 'Magic Wand' },
    { key: 'force_staff', minute: 18, label: 'Force Staff' },
    { key: 'blink', minute: 16, label: 'Blink Dagger' },
  ],
}

export function targetsForHero(
  heroId: number,
  role: Role,
): Array<{ key: string; minute: number; label: string }> {
  const custom = HERO_ITEM_TARGETS[heroId]
  if (custom?.length) {
    return custom.map((t) => ({ ...t, label: itemLabel(t.key) }))
  }
  return ROLE_ITEM_TARGETS[role]
}

export { itemLabel }

export function inferRole(
  laneRole?: number,
  slot?: number,
  heroRoles?: string[],
  gpm?: number,
): Role {
  const roles = (heroRoles ?? []).map((r) => r.toLowerCase())
  const isSupport = roles.includes('support')
  const isCarry = roles.includes('carry')

  // Чистый саппорт по тегам героя — не ставим керри из-за слота/линии.
  if (isSupport && !isCarry) {
    if (laneRole === 2) return 'soft'
    return gpm !== undefined && gpm < 320 ? 'hard' : 'soft'
  }

  // Сначала линия из матча — mid/off надёжнее тегов героя.
  if (laneRole === 2) return 'mid'
  if (laneRole === 3) return 'offlane'
  if (laneRole === 4) return 'soft'
  if (laneRole === 5) return 'hard'

  // Саппорт в сейве часто lane_role=1 — не путаем с керри.
  if (laneRole === 1) {
    if (isSupport && (gpm === undefined || gpm < 420)) {
      return gpm !== undefined && gpm < 320 ? 'hard' : 'soft'
    }
    return 'carry'
  }

  const teamIndex = slot !== undefined ? (slot < 128 ? slot : slot - 128) : 2
  const order: Role[] = ['carry', 'mid', 'offlane', 'soft', 'hard']
  return order[Math.min(teamIndex, 4)]
}

/** Кривая ожидания: линейный рост к baseline * duration/60 к концу матча. */
export function expectedSeries(
  minutes: number,
  baselinePerMin: number,
): number[] {
  const out: number[] = []
  for (let m = 0; m <= minutes; m++) {
    const pace = baselinePerMin * (0.55 + 0.45 * (m / Math.max(minutes, 1)))
    out.push(Math.round(pace * m))
  }
  return out
}

export function padSeries(series: number[] | undefined, minutes: number): number[] {
  if (!series?.length) {
    return Array.from({ length: minutes + 1 }, () => 0)
  }
  const out = series.slice(0, minutes + 1)
  while (out.length < minutes + 1) {
    out.push(out[out.length - 1] ?? 0)
  }
  return out
}
