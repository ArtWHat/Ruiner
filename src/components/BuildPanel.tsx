import { itemIconUrl } from '../data/items'
import type { PlayerAnalysis } from '../types'

export function BuildPanel({ player }: { player: PlayerAnalysis }) {
  const b = player.build
  const bar = Math.max(8, Math.min(100, b.score * 10))

  return (
    <div className="build-panel">
      <div className="build-head">
        <div className="build-hero">
          <img src={player.heroImage} alt={player.heroName} />
          <div>
            <div className="build-hero-name">{player.heroName}</div>
            <div className="build-player-name">{player.displayName}</div>
          </div>
        </div>
        <div className="build-score">
          <div className="build-score-num">
            {b.score}
            <span>из 10</span>
          </div>
          <div className="build-score-bar">
            <i style={{ width: `${bar}%` }} />
          </div>
        </div>
      </div>

      <div className="build-items">
        {b.items.length === 0 && (
          <span className="hint">Нет крупных предметов в логе покупки</span>
        )}
        {b.items.map((it) => (
          <div
            key={`${it.key}-${it.minute}`}
            className="build-item"
            title={`${it.label}: ${it.timingNote}`}
          >
            <img src={itemIconUrl(it.key)} alt={it.label} />
            <div className={`build-item-time tone-${it.timingTone}`}>{it.minute}м</div>
          </div>
        ))}
      </div>

      <p className="build-summary">{b.summary}</p>

      <ul className="build-points">
        {b.points.map((p) => (
          <li key={p.text} className={p.tone === 'good' ? 'plus' : 'minus'}>
            <span className="mark">{p.tone === 'good' ? '+' : '−'}</span>
            {p.itemKey ? (
              <img
                className="build-point-icon"
                src={itemIconUrl(p.itemKey)}
                alt=""
              />
            ) : null}
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
