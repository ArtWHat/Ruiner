import type { PlayerAnalysis } from '../types'

interface Props {
  player: PlayerAnalysis
}

export function ItemTimeline({ player }: Props) {
  const byKey = new Map(player.itemFacts.map((i) => [i.key, i.minute]))

  return (
    <div className="items">
      <h4>Предметы: факт vs ориентир «хорошей игры»</h4>
      {player.itemTargets.map((t) => {
        const actual = byKey.get(t.key)
        let cls = 'miss'
        let actualText = 'не куплен'
        if (actual !== undefined) {
          actualText = `${actual} мин`
          cls = actual <= t.minute + 3 ? 'ok' : 'late'
        }
        return (
          <div className="item-row" key={t.key}>
            <div>{t.label}</div>
            <div className={cls}>факт: {actualText}</div>
            <div>цель: {t.minute} мин</div>
          </div>
        )
      })}
      <p className="hint">
        Ориентиры эвристические по роли, не копия Dota Plus. shortcut: общие
        тайминги по роли, уточнять по герою при необходимости.
      </p>
    </div>
  )
}
