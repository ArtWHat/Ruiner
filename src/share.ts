import type { MatchAnalysis } from './types'

export function matchShareUrl(matchId: number): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('m', String(matchId))
  return url.toString()
}

export function parseMatchQuery(): number | null {
  const raw = new URLSearchParams(window.location.search).get('m')
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

/** Рисует простую карточку для превью / вложения. */
export function drawRuinerCard(analysis: MatchAnalysis): HTMLCanvasElement {
  const r = analysis.ruiner
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 1200, 630)
  g.addColorStop(0, '#140f14')
  g.addColorStop(1, '#1a1020')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1200, 630)

  ctx.fillStyle = '#ff5c5c'
  ctx.font = 'bold 42px Segoe UI, Arial'
  ctx.fillText('RUINER', 64, 90)

  ctx.fillStyle = '#f2f4f8'
  ctx.font = 'bold 64px Segoe UI, Arial'
  ctx.fillText(r.heroName, 64, 200)

  ctx.fillStyle = '#c5cbe0'
  ctx.font = '36px Segoe UI, Arial'
  ctx.fillText(r.displayName, 64, 260)

  ctx.fillStyle = '#ff8d8d'
  ctx.font = 'bold 48px Segoe UI, Arial'
  ctx.fillText(`${r.impactPct}% импакт · ${r.grade}`, 64, 360)

  ctx.fillStyle = '#8b93a7'
  ctx.font = '28px Segoe UI, Arial'
  ctx.fillText(
    `Матч ${analysis.matchId} · победа ${analysis.radiantWin ? 'Света' : 'Тьмы'}`,
    64,
    440,
  )

  ctx.fillStyle = '#5a6278'
  ctx.font = '24px Segoe UI, Arial'
  ctx.fillText('Кто заруинил игру', 64, 560)

  return canvas
}

export async function copyShareLink(analysis: MatchAnalysis): Promise<'copied' | 'shared' | 'failed'> {
  const url = matchShareUrl(analysis.matchId)
  const title = `RUINER: ${analysis.ruiner.heroName} заруинил матч ${analysis.matchId}`
  const text = `${title}\n${url}`

  try {
    const canvas = drawRuinerCard(analysis)
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/png'),
    )
    if (blob && navigator.share && navigator.canShare?.({ files: [new File([blob], 'ruiner.png', { type: 'image/png' })] })) {
      const file = new File([blob], 'ruiner.png', { type: 'image/png' })
      await navigator.share({ title, text, url, files: [file] })
      return 'shared'
    }
  } catch {
    // fall through to clipboard
  }

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return 'shared'
    }
  } catch {
    // user cancel or unsupported
  }

  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function applyShareMeta(analysis: MatchAnalysis) {
  const title = `RUINER · ${analysis.ruiner.heroName} заруинил матч ${analysis.matchId}`
  document.title = title
  const desc = `${analysis.ruiner.displayName} на ${analysis.ruiner.heroName} · импакт ${analysis.ruiner.impactPct}% · ${analysis.ruiner.grade}`

  const set = (prop: string, content: string, isName = false) => {
    const attr = isName ? 'name' : 'property'
    let el = document.head.querySelector(`meta[${attr}="${prop}"]`) as HTMLMetaElement | null
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute(attr, prop)
      document.head.appendChild(el)
    }
    el.content = content
  }

  const image = `${window.location.origin}/og-ruiner.svg`
  set('og:title', title)
  set('og:description', desc)
  set('og:image', image)
  set('og:url', matchShareUrl(analysis.matchId))
  set('description', desc, true)
  set('twitter:title', title)
  set('twitter:description', desc)
  set('twitter:image', image)
}
