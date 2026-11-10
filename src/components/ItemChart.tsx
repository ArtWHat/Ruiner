import { itemIconUrl } from '../data/items'
import type { PlayerAnalysis } from '../types'

interface Props {
  player: PlayerAnalysis
}

function Marks({
  items,
  maxMin,
  variant,
}: {
  items: Array<{ key: string; minute: number; label: string; why?: string }>
  maxMin: number
  variant: 'fact' | 'target'
}) {
  return (
    <div className={`item-chart-lane track ${variant}-track`}>
      {items.map((t) => {
        const left = `${Math.min(97, Math.max(2, (t.minute / maxMin) * 100))}%`
        const tip = t.why
          ? `${t.label}: ${t.minute} мин — ${t.why}`
          : `${t.label}: ${t.minute} мин`
        return (
          <div
            key={`${variant}-${t.key}-${t.minute}`}
            className={`item-mark ${variant}`}
            style={{ left }}
            title={tip}
          >
            <img
              src={itemIconUrl(t.key)}
              alt={t.label}
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.opacity = '0.25'
              }}
            />
            <span className="item-min">{t.minute}м</span>
          </div>
        )
      })}
    </div>
  )
}

export function ItemChart({ player }: Props) {
  const facts = player.itemTimeline.length
    ? player.itemTimeline
    : player.itemFacts
  const maxMin = Math.max(
    25,
    player.goldActual.length - 1,
    ...facts.map((f) => f.minute),
    ...player.itemTargets.map((t) => t.minute),
  )
  const ticks = Array.from({ length: 6 }, (_, i) =>
    Math.round((maxMin * i) / 5),
  )

  return (
    <div className="item-chart">
      <div className="item-chart-legend">
        <span>
          <i className="dot fact" /> факт в этом матче
        </span>
        <span>
          <i className="dot target" /> цель с учётом врагов
        </span>
      </div>

      <div className="item-chart-rail">
        <div className="item-chart-lane label">Факт</div>
        <Marks items={facts} maxMin={maxMin} variant="fact" />

        <div className="item-chart-lane label">
          Цель для {player.heroName} (контры и тайминги)
        </div>
        <Marks items={player.itemTargets} maxMin={maxMin} variant="target" />

        <div className="item-time-scale">
          {ticks.map((t) => (
            <span key={t}>{t} мин</span>
          ))}
        </div>
      </div>

      <ul className="item-why">
        {player.itemTargets
          .filter((t) => t.why)
          .slice(0, 6)
          .map((t) => (
            <li key={`why-${t.key}-${t.minute}`}>
              <img src={itemIconUrl(t.key)} alt="" />
              <span>
                <strong>{t.label}</strong> к {t.minute} мин — {t.why}
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}
