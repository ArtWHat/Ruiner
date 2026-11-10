import { itemIconUrl } from '../data/items'
import { countVision } from '../analysis/supportVision'
import type { PlayerAnalysis } from '../types'

const VISION_LABEL: Record<string, string> = {
  ward_observer: 'Observer',
  ward_sentry: 'Sentry',
  dust: 'Dust',
  smoke_of_deceit: 'Smoke',
  gem: 'Gem',
}

export function ImpactPanel({ player }: { player: PlayerAnalysis }) {
  const v = countVision(player.player)
  const isSupport = player.role === 'soft' || player.role === 'hard'
  const bought =
    v.dust + v.gem + v.ward_sentry + v.ward_observer + v.smoke_of_deceit > 0
  const showVision = isSupport || bought

  return (
    <div className="impact-panel">
      <div className="impact-overview">
        <h4>Общий разбор</h4>
        <p>{player.overview}</p>
      </div>

      {showVision && (
        <div className="vision-block">
          <h4>Варды и детекция</h4>
          <div className="vision-row">
            {(Object.keys(VISION_LABEL) as (keyof typeof v)[]).map((key) => (
              <div key={key} className={`vision-chip${v[key] === 0 ? ' empty' : ''}`}>
                <img src={itemIconUrl(key)} alt={VISION_LABEL[key]} />
                <span>
                  {VISION_LABEL[key]} ×{v[key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h4>Драки и моменты</h4>
      <ul className="impact-list">
        {player.impactEvents.map((e, i) => (
          <li key={`${e.minute}-${i}`} className={`tone-${e.tone}`}>
            <strong>{e.title}</strong>
            <span>{e.detail}</span>
          </li>
        ))}
      </ul>
      <div className="impact-summary">
        {player.summary.map((s) => (
          <span key={s.text} className={`chip tone-${s.tone}`}>
            {s.text}
          </span>
        ))}
      </div>
    </div>
  )
}
