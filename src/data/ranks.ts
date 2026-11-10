export const RANK_MEDALS = [
  { id: 1, name: 'Рекрут' },
  { id: 2, name: 'Страж' },
  { id: 3, name: 'Рыцарь' },
  { id: 4, name: 'Герой' },
  { id: 5, name: 'Легенда' },
  { id: 6, name: 'Властелин' },
  { id: 7, name: 'Божество' },
  { id: 8, name: 'Титан' },
] as const

/**
 * Множитель средней экономики к «Легенде» (=1).
 * Разброс шире, чтобы Титан заметно выше Героя/Легенды на графике.
 */
export const RANK_CURVE_MULT: Record<number, number> = {
  1: 0.58,
  2: 0.68,
  3: 0.78,
  4: 0.88,
  5: 1,
  6: 1.16,
  7: 1.36,
  8: 1.58,
}

const ICON =
  'https://www.opendota.com/assets/images/dota2/rank_icons'

export function rankMedal(rankTier?: number): number {
  if (!rankTier || rankTier < 10) return 0
  return Math.min(8, Math.floor(rankTier / 10))
}

export function rankStars(rankTier?: number): number {
  if (!rankTier || rankTier < 10) return 0
  if (rankTier >= 80) return 0
  return Math.min(5, rankTier % 10)
}

export function rankName(rankTier?: number): string {
  const m = rankMedal(rankTier)
  if (!m) return 'Без ранга'
  return RANK_MEDALS[m - 1]?.name ?? 'Без ранга'
}

export function rankIconUrl(medal: number): string {
  if (medal < 1) return `${ICON}/rank_icon_0.png`
  return `${ICON}/rank_icon_${medal}.png`
}

export function scaleSeries(series: number[], mult: number): number[] {
  return series.map((v) => Math.round(v * mult))
}
