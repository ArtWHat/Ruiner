import type { MatchAnalysis, PlayerAnalysis } from '../types'
import { RankIcon } from './RankIcon'

interface Props {
  analysis: MatchAnalysis
  selected: PlayerAnalysis
  onSelect: (p: PlayerAnalysis) => void
}

function TeamBlock({
  title,
  win,
  side,
  players,
  selected,
  onSelect,
}: {
  title: string
  win: boolean
  side: 'radiant' | 'dire'
  players: PlayerAnalysis[]
  selected: PlayerAnalysis
  onSelect: (p: PlayerAnalysis) => void
}) {
  return (
    <div>
      <div className={`team-head ${side}`}>
        <span>{title}</span>
        {win ? <span className="win-tag">Победа</span> : <span />}
      </div>
      {players.map((p) => (
        <div
          key={p.player.player_slot}
          className={`player-row${selected === p ? ' active' : ''}`}
          onClick={() => onSelect(p)}
        >
          <img src={p.heroImage} alt={p.heroName} />
          <div>
            <div className="name">{p.displayName}</div>
            <div className="hero">
              {p.player.level} ЛВЛ · {p.heroName}
            </div>
          </div>
          <div className="grade-wrap">
            <RankIcon rankTier={p.player.rank_tier} size={28} />
            <div className={`grade ${p.grade}`}>{p.grade}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function TeamList({ analysis, selected, onSelect }: Props) {
  const radiant = analysis.players.filter((p) => p.player.isRadiant)
  const dire = analysis.players.filter((p) => !p.player.isRadiant)

  return (
    <div className="panel team-panel">
      <TeamBlock
        title="Силы Света"
        side="radiant"
        win={analysis.radiantWin}
        players={radiant}
        selected={selected}
        onSelect={onSelect}
      />
      <TeamBlock
        title="Силы Тьмы"
        side="dire"
        win={!analysis.radiantWin}
        players={dire}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  )
}
