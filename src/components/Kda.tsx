import type { Role, Tone } from '../types'

/** Ожидания K/D/A к ~40 мин по роли: [плохоНиже, хорошоОт]. Для смертей наоборот. */
const EXPECT: Record<Role, { k: [number, number]; d: [number, number]; a: [number, number] }> =
  {
    carry: { k: [5, 10], d: [8, 4], a: [5, 10] },
    mid: { k: [5, 10], d: [8, 4], a: [5, 11] },
    offlane: { k: [3, 7], d: [9, 5], a: [8, 14] },
    soft: { k: [2, 5], d: [10, 5], a: [12, 20] },
    hard: { k: [1, 4], d: [11, 6], a: [12, 22] },
  }

function toneKills(v: number, role: Role): Tone {
  const [badBelow, goodFrom] = EXPECT[role].k
  if (v >= goodFrom) return 'good'
  if (v < badBelow) return 'bad'
  return 'mid'
}

function toneDeaths(v: number, role: Role): Tone {
  const [badFrom, goodAtMost] = EXPECT[role].d
  if (v <= goodAtMost) return 'good'
  if (v >= badFrom) return 'bad'
  return 'mid'
}

function toneAssists(v: number, role: Role): Tone {
  const [badBelow, goodFrom] = EXPECT[role].a
  if (v >= goodFrom) return 'good'
  if (v < badBelow) return 'bad'
  return 'mid'
}

export function Kda({
  kills,
  deaths,
  assists,
  role,
}: {
  kills: number
  deaths: number
  assists: number
  role: Role
}) {
  return (
    <span className="kda">
      <span className={`tone-${toneKills(kills, role)}`}>{kills}</span>
      <span className="sep">/</span>
      <span className={`tone-${toneDeaths(deaths, role)}`}>{deaths}</span>
      <span className="sep">/</span>
      <span className={`tone-${toneAssists(assists, role)}`}>{assists}</span>
    </span>
  )
}

export function toneClass(actual: number, expected: number): string {
  const d = (actual - expected) / Math.max(1, expected)
  if (d >= 0.08) return 'tone-good'
  if (d <= -0.12) return 'tone-bad'
  return 'tone-mid'
}
