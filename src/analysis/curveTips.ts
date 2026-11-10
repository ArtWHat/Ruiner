import type { PlayerAnalysis } from '../types'

function windowGain(series: number[], start: number, w: number): number {
  const a = series[start] ?? 0
  const b = series[Math.min(series.length - 1, start + w)] ?? a
  return b - a
}

function bestWorstWindow(
  series: number[],
  window = 5,
): { best: number; worst: number; bestGain: number; worstGain: number } {
  if (series.length < 3) return { best: 1, worst: 1, bestGain: 0, worstGain: 0 }
  let bestM = 1
  let worstM = 1
  let bestGain = -Infinity
  let worstGain = Infinity
  const w = Math.min(window, Math.max(2, Math.floor(series.length / 4)))
  for (let m = 1; m + w < series.length; m++) {
    const gain = windowGain(series, m, w)
    if (gain > bestGain) {
      bestGain = gain
      bestM = m
    }
    if (gain < worstGain) {
      worstGain = gain
      worstM = m
    }
  }
  return { best: bestM, worst: worstM, bestGain, worstGain }
}

/** Минуты, где золото почти не росло (мало фарма). */
function idleFarmWindows(actual: number[], expected: number[]): string[] {
  const out: string[] = []
  let start: number | null = null
  for (let m = 1; m < actual.length; m++) {
    const gain = (actual[m] ?? 0) - (actual[m - 1] ?? 0)
    const need = Math.max(40, ((expected[m] ?? 0) - (expected[m - 1] ?? 0)) * 0.35)
    const idle = gain < need
    if (idle && start === null) start = m - 1
    if ((!idle || m === actual.length - 1) && start !== null) {
      const end = idle && m === actual.length - 1 ? m : m - 1
      if (end - start >= 4) {
        out.push(
          `С ${start} по ${end} минуту почти не фармил — золото почти не росло.`,
        )
      }
      start = null
      if (out.length >= 2) break
    }
  }
  return out
}

function deathTips(p: PlayerAnalysis): string[] {
  const tips: string[] = []
  for (const e of p.impactEvents) {
    if (!e.title.startsWith('Драка')) continue
    if (e.tone !== 'bad') continue
    const goldMatch = e.detail.match(/(-?\d+)\s*золот/)
    const lost = goldMatch ? Number(goldMatch[1]) : 0
    if (e.detail.includes('Умер') || e.detail.includes('смерть')) {
      if (lost < 0) {
        tips.push(
          `На ~${e.minute} минуте умер в драке и потерял около ${Math.abs(lost)} золота.`,
        )
      } else {
        tips.push(`На ~${e.minute} минуте умер в драке почти без пользы.`)
      }
    }
    if (tips.length >= 2) break
  }
  if (!tips.length && p.player.deaths >= 8) {
    tips.push(
      `За матч ${p.player.deaths} смертей — из-за них сильно терял золото и темп.`,
    )
  }
  return tips
}

export function goldTips(p: PlayerAnalysis): string[] {
  const tips: string[] = []
  const { best, worst, bestGain, worstGain } = bestWorstWindow(p.goldActual)
  const vsRole = Math.round(
    ((p.player.gold_per_min - p.expectedGpm) / Math.max(1, p.expectedGpm)) * 100,
  )

  tips.push(
    `Лучший фарм: ${best}–${best + 5} мин (+${Math.max(0, Math.round(bestGain))} золота).`,
  )
  tips.push(
    `Худший фарм: ${worst}–${worst + 5} мин (всего ${Math.round(worstGain)} золота за 5 минут).`,
  )

  if (vsRole >= 12) {
    tips.push(
      `GPM ${p.player.gold_per_min} — выше обычного примерно на ${vsRole}%.`,
    )
  } else if (vsRole <= -12) {
    tips.push(
      `GPM ${p.player.gold_per_min} — ниже обычного примерно на ${Math.abs(vsRole)}%.`,
    )
  } else {
    tips.push(`GPM ${p.player.gold_per_min} — около нормы (${p.expectedGpm}).`)
  }

  tips.push(...deathTips(p))
  tips.push(...idleFarmWindows(p.goldActual, p.goldExpected))

  if (worstGain < 200 && tips.length < 6) {
    tips.push(
      `В окне ${worst}–${worst + 5} мин почти не зарабатывал — бегал без фарма или часто отходил.`,
    )
  }

  return tips.slice(0, 6)
}

export function xpTips(p: PlayerAnalysis): string[] {
  const tips: string[] = []
  const { best, worst, bestGain, worstGain } = bestWorstWindow(p.xpActual)
  const n = p.xpActual.length - 1
  const minutes = Math.max(1, n)
  const level = p.player.level
  const expectedLevel = Math.min(30, Math.round(1 + minutes * 0.55))
  const lvlDelta = level - expectedLevel
  const vsRole = Math.round(
    ((p.player.xp_per_min - p.expectedXpm) / Math.max(1, p.expectedXpm)) * 100,
  )

  tips.push(
    `Лучший набор опыта: ${best}–${best + 5} мин (+${Math.max(0, Math.round(bestGain))} XP).`,
  )
  tips.push(
    `Слабый набор опыта: ${worst}–${worst + 5} мин (${Math.round(worstGain)} XP).`,
  )
  tips.push(
    `Закончил на ${level} лвл (для ${minutes} мин обычно около ${expectedLevel}).`,
  )

  if (vsRole >= 12) {
    tips.push(`XPM ${p.player.xp_per_min} — выше обычного примерно на ${vsRole}%.`)
  } else if (vsRole <= -12) {
    tips.push(
      `XPM ${p.player.xp_per_min} — ниже обычного примерно на ${Math.abs(vsRole)}%.`,
    )
  } else {
    tips.push(`XPM ${p.player.xp_per_min} — около нормы (${p.expectedXpm}).`)
  }

  if (lvlDelta <= -2) {
    tips.push(
      `Уровень отставал на ${Math.abs(lvlDelta)}: лучше было спокойно качаться в лесу или на лёгкой, без лишних драк.`,
    )
  } else if (lvlDelta >= 2) {
    tips.push(
      `Уровень выше обычного на ${lvlDelta}: можно было чаще ходить в драки и пуши.`,
    )
  }

  if (worstGain < 400) {
    tips.push(
      `С ${worst} по ${worst + 5} минуту почти не получал опыт — стоял без крипов или часто умирал.`,
    )
  }

  return tips.slice(0, 6)
}
