import { useEffect, useState } from 'react'
import { analyzeDraft, type HeroFit } from '../api/matchups'
import { heroImageUrl, getHero } from '../api/opendota'
import type { MatchAnalysis } from '../types'

interface Props {
  analysis: MatchAnalysis
  onClose: () => void
}

function HeroFitRow({ h }: { h: HeroFit }) {
  return (
    <div className={`draft-fit-row tag-${h.tag}`}>
      <img src={heroImageUrl(getHero(h.heroId))} alt={h.name} />
      <div className="draft-fit-meta">
        <div className="draft-fit-name">
          {h.name}
          {h.tag === 'good' && <span className="fit-pill good">хорошо в пик</span>}
          {h.tag === 'bad' && <span className="fit-pill bad">плохо в пик</span>}
        </div>
        <div className="fit-bar">
          <i style={{ width: `${Math.max(8, Math.min(100, h.fit))}%` }} />
        </div>
      </div>
      <div className="fit-num">{h.fit}</div>
    </div>
  )
}

export function DraftModal({ analysis, onClose }: Props) {
  const radiantIds = analysis.players
    .filter((p) => p.player.isRadiant)
    .map((p) => p.player.hero_id)
  const direIds = analysis.players
    .filter((p) => !p.player.isRadiant)
    .map((p) => p.player.hero_id)

  const [loading, setLoading] = useState(true)
  const [verdict, setVerdict] = useState('Считаю пик…')
  const [radiant, setRadiant] = useState<HeroFit[]>([])
  const [dire, setDire] = useState<HeroFit[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const edge = await analyzeDraft(radiantIds, direIds)
        if (!alive) return
        setRadiant(edge.radiant)
        setDire(edge.dire)
        setVerdict(edge.verdict)
      } catch {
        if (alive) setVerdict('Не удалось загрузить матчапы OpenDota')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [analysis.matchId])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top center">
          <h2>Драфт</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="draft-cols">
          <div>
            <div className="draft-side radiant">Силы Света</div>
            {loading
              ? radiantIds.map((id) => (
                  <div key={id} className="draft-fit-row">
                    <img src={heroImageUrl(getHero(id))} alt="" />
                    <div className="draft-fit-meta">
                      <div className="fit-bar">
                        <i style={{ width: '30%' }} />
                      </div>
                    </div>
                  </div>
                ))
              : radiant.map((h) => <HeroFitRow key={h.heroId} h={h} />)}
          </div>
          <div>
            <div className="draft-side dire">Силы Тьмы</div>
            {loading
              ? direIds.map((id) => (
                  <div key={id} className="draft-fit-row">
                    <img src={heroImageUrl(getHero(id))} alt="" />
                    <div className="draft-fit-meta">
                      <div className="fit-bar">
                        <i style={{ width: '30%' }} />
                      </div>
                    </div>
                  </div>
                ))
              : dire.map((h) => <HeroFitRow key={h.heroId} h={h} />)}
          </div>
        </div>

        <p className="draft-verdict">{loading ? 'Считаю пик…' : verdict}</p>
      </div>
    </div>
  )
}
