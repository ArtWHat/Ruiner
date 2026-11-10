import type { MatchPlayer, Role } from '../types'

const INVIS_HEROES = new Set([9, 32, 62, 80, 88, 93, 12]) // Mirana, Riki, BH, Lone, Nyx, Spectre-ish, PL

const VISION_KEYS = [
  'ward_observer',
  'ward_sentry',
  'dust',
  'smoke_of_deceit',
  'gem',
] as const

export function countVision(p: MatchPlayer): Record<(typeof VISION_KEYS)[number], number> {
  const out = {
    ward_observer: 0,
    ward_sentry: 0,
    dust: 0,
    smoke_of_deceit: 0,
    gem: 0,
  }
  for (const buy of p.purchase_log ?? []) {
    if (buy.time < 0) continue
    if (buy.key in out) out[buy.key as keyof typeof out] += 1
  }
  return out
}

export function enemyHasInvis(enemies: MatchPlayer[]): boolean {
  if (enemies.some((e) => INVIS_HEROES.has(e.hero_id))) return true
  for (const e of enemies) {
    for (const buy of e.purchase_log ?? []) {
      if (buy.time < 0) continue
      if (
        buy.key === 'shadow_blade' ||
        buy.key === 'silver_edge' ||
        buy.key === 'invis_sword' ||
        buy.key === 'glimmer_cape'
      ) {
        return true
      }
    }
  }
  return false
}

export function supportVisionNotes(
  p: MatchPlayer,
  role: Role,
  enemies: MatchPlayer[],
): string[] {
  if (role !== 'soft' && role !== 'hard') return []
  const v = countVision(p)
  const notes: string[] = []
  const wards = v.ward_observer + v.ward_sentry
  if (wards === 0) notes.push('Почти не покупал варды (observer/sentry).')
  else notes.push(`Варды: ${v.ward_observer} observer, ${v.ward_sentry} sentry.`)

  if (v.smoke_of_deceit > 0) notes.push(`Смоки: ${v.smoke_of_deceit}.`)
  else notes.push('Смоки не брал.')

  const needDetect = enemyHasInvis(enemies)
  const detect = v.dust + v.ward_sentry + v.gem
  if (needDetect) {
    if (detect === 0) {
      notes.push('У врагов инвиз, а детекции (dust/sentry/gem) почти нет.')
    } else {
      notes.push(
        `Детекция против инвиза: dust ${v.dust}, sentry ${v.ward_sentry}, gem ${v.gem}.`,
      )
    }
  } else if (v.dust > 0 || v.gem > 0) {
    notes.push(`Детекция: dust ${v.dust}, gem ${v.gem}.`)
  }

  return notes
}
