import { RANK_MEDALS, rankIconUrl } from '../data/ranks'

interface Props {
  value: number | null
  onChange: (medal: number | null) => void
}

export function RankPicker({ value, onChange }: Props) {
  return (
    <div className="rank-picker">
      <span className="rank-picker-label">Сравнить с рангом на этом герое:</span>
      <div className="rank-picker-row">
        {RANK_MEDALS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`rank-pick${value === r.id ? ' active' : ''}`}
            title={r.name}
            onClick={() => onChange(value === r.id ? null : r.id)}
          >
            <img src={rankIconUrl(r.id)} alt={r.name} />
            <span>{r.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
