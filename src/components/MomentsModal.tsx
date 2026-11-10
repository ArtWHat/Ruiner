import { heroImageUrl, getHero } from '../api/opendota'
import type { MatchAnalysis } from '../types'

/** Вероятность победы Света по золоту и опыту. 50% = равные шансы. */
function winProb(goldAdv: number, xpAdv: number): number {
  const mixed = goldAdv * 0.65 + xpAdv * 0.35
  return Math.round(50 + Math.max(-45, Math.min(45, mixed / 400)))
}

function ProbSide({
  side,
  pct,
  delta,
}: {
  side: 'Свет' | 'Тьма'
  pct: number
  delta: number
}) {
  const cls =
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  return (
    <div className={`prob-side-card ${cls}`}>
      <span className="prob-side-name">{side}</span>
      <span className="prob-side-pct">{pct}%</span>
      <span className="prob-side-delta">
        {delta > 0 ? '+' : ''}
        {delta}% к шансу
      </span>
    </div>
  )
}

interface Props {
  analysis: MatchAnalysis
  onClose: () => void
}

export function MomentsModal({ analysis, onClose }: Props) {
  const fights = analysis.teamfights
    .map((tf, idx) => {
      const minute = Math.max(0, Math.round(tf.start / 60))
      const g0 = analysis.radiantGoldAdv[Math.max(0, minute - 1)] ?? 0
      const g1 = analysis.radiantGoldAdv[minute] ?? g0
      const x0 = analysis.radiantXpAdv[Math.max(0, minute - 1)] ?? 0
      const x1 = analysis.radiantXpAdv[minute] ?? x0
      const radiantBefore = winProb(g0, x0)
      const radiantAfter = winProb(g1, x1)
      const direBefore = 100 - radiantBefore
      const direAfter = 100 - radiantAfter
      const rows = analysis.players.map((p, i) => {
        const me = tf.players?.[i]
        const kills = (p.player.kills_log ?? []).filter(
          (k) => k.time >= tf.start && k.time <= tf.end,
        ).length
        return {
          player: p,
          damage: me?.damage ?? 0,
          xp: me?.xp_delta ?? 0,
          gold: me?.gold_delta ?? 0,
          died: (me?.deaths ?? 0) > 0,
          kills,
        }
      })
      return {
        idx,
        minute,
        radiantBefore,
        radiantAfter,
        direBefore,
        direAfter,
        radiantDelta: radiantAfter - radiantBefore,
        direDelta: direAfter - direBefore,
        rows,
      }
    })
    .filter((f) => f.rows.some((r) => r.damage > 400 || r.died || r.kills > 0))
    .slice(0, 12)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top center">
          <h2>Решающие моменты</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="modal-lead">
          Старт 50/50. После каждой драки — шанс победы Света и Тьмы по золоту и
          опыту команды.
        </p>
        <div className="moments-list">
          {fights.length === 0 && <p className="hint">Нет данных teamfights</p>}
          {fights.map((f) => (
            <article key={f.idx} className="moment-card">
              <div className="moment-head">
                <strong>~{f.minute} мин</strong>
                <div className="prob-pair">
                  <ProbSide
                    side="Свет"
                    pct={f.radiantAfter}
                    delta={f.radiantDelta}
                  />
                  <ProbSide side="Тьма" pct={f.direAfter} delta={f.direDelta} />
                </div>
              </div>
              <div className="win-bar" aria-hidden>
                <i
                  className="win-bar-radiant"
                  style={{ width: `${f.radiantAfter}%` }}
                />
                <i
                  className="win-bar-dire"
                  style={{ width: `${f.direAfter}%` }}
                />
              </div>
              <div className="moment-grid">
                {f.rows
                  .filter((r) => r.damage > 200 || r.died || r.kills > 0)
                  .sort((a, b) => b.damage - a.damage)
                  .map((r) => (
                    <div key={r.player.player.player_slot} className="moment-row">
                      <img
                        src={
                          r.player.heroImage ||
                          heroImageUrl(getHero(r.player.player.hero_id))
                        }
                        alt={r.player.heroName}
                      />
                      <div className="moment-meta">
                        <div>{r.player.heroName}</div>
                        <div className="moment-stats">
                          урон <b className="tone-mid">{r.damage}</b>
                          {' · '}киллы{' '}
                          <b className="tone-good">{r.kills}</b>
                          {' · '}смерть{' '}
                          <b className={r.died ? 'tone-bad' : 'tone-good'}>
                            {r.died ? 'да' : 'нет'}
                          </b>
                          {' · '}XP{' '}
                          <b className={r.xp >= 0 ? 'tone-good' : 'tone-bad'}>
                            {r.xp >= 0 ? '+' : ''}
                            {r.xp}
                          </b>
                          {' · '}зол.{' '}
                          <b className={r.gold >= 0 ? 'tone-good' : 'tone-bad'}>
                            {r.gold >= 0 ? '+' : ''}
                            {r.gold}
                          </b>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
