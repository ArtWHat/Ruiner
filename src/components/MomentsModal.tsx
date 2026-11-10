import { heroImageUrl, getHero } from '../api/opendota'
import type { MatchAnalysis, PlayerAnalysis } from '../types'

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
  const cls = pct >= 55 ? 'up' : pct <= 45 ? 'down' : 'flat'
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

type FightRow = {
  player: PlayerAnalysis
  damage: number
  xp: number
  gold: number
  died: boolean
  kills: number
}

function FightHero({ r }: { r: FightRow }) {
  return (
    <div className={`moment-row${r.died ? ' dead' : ''}`}>
      <img
        src={r.player.heroImage || heroImageUrl(getHero(r.player.player.hero_id))}
        alt={r.player.heroName}
      />
      <div className="moment-meta">
        <div className="moment-hero-name">{r.player.heroName}</div>
        <div className="moment-stats">
          урон <b className="tone-mid">{r.damage}</b>
          {' · '}
          <b className="tone-good">{r.kills}</b> кил
          {r.died ? (
            <>
              {' · '}
              <b className="tone-bad">смерть</b>
            </>
          ) : null}
        </div>
      </div>
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
      const rows: FightRow[] = analysis.players.map((p, i) => {
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
      const radiant = rows.filter((r) => r.player.player.isRadiant)
      const dire = rows.filter((r) => !r.player.player.isRadiant)
      const sum = (list: FightRow[], key: 'gold' | 'xp' | 'damage') =>
        list.reduce((s, r) => s + r[key], 0)
      const deathsOf = (list: FightRow[]) => list.filter((r) => r.died).length

      return {
        idx,
        minute,
        radiantBefore,
        radiantAfter,
        direBefore,
        direAfter,
        radiantDelta: radiantAfter - radiantBefore,
        direDelta: direAfter - direBefore,
        radiant,
        dire,
        team: {
          radiantGold: sum(radiant, 'gold'),
          direGold: sum(dire, 'gold'),
          radiantXp: sum(radiant, 'xp'),
          direXp: sum(dire, 'xp'),
          radiantDmg: sum(radiant, 'damage'),
          direDmg: sum(dire, 'damage'),
          radiantDeaths: deathsOf(radiant),
          direDeaths: deathsOf(dire),
        },
      }
    })
    .filter(
      (f) =>
        f.radiant.some((r) => r.damage > 400 || r.died || r.kills > 0) ||
        f.dire.some((r) => r.damage > 400 || r.died || r.kills > 0),
    )
    .slice(0, 12)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top center">
          <h2>Решающие моменты</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="modal-lead">
          Слева Силы Света, справа Силы Тьмы. В центре — итог драки по золоту,
          опыту и смертям.
        </p>
        <div className="moments-list">
          {fights.length === 0 && <p className="hint">Нет данных teamfights</p>}
          {fights.map((f) => {
            const show = (r: FightRow) => r.damage > 200 || r.died || r.kills > 0
            const rad = f.radiant.filter(show).sort((a, b) => b.damage - a.damage)
            const dire = f.dire.filter(show).sort((a, b) => b.damage - a.damage)
            return (
              <article key={f.idx} className="moment-card">
                <div className="moment-head">
                  <strong>~{f.minute} мин</strong>
                  <div className="prob-pair">
                    <ProbSide
                      side="Свет"
                      pct={f.radiantAfter}
                      delta={f.radiantDelta}
                    />
                    <ProbSide
                      side="Тьма"
                      pct={f.direAfter}
                      delta={f.direDelta}
                    />
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

                <div className="moment-teams">
                  <div className="moment-col radiant">
                    <div className="moment-col-title">Силы Света</div>
                    {rad.map((r) => (
                      <FightHero key={r.player.player.player_slot} r={r} />
                    ))}
                    {rad.length === 0 && (
                      <div className="hint">Почти не участвовали</div>
                    )}
                  </div>

                  <div className="moment-mid">
                    <div className="moment-mid-title">Итог драки</div>
                    <div className="moment-mid-row">
                      <span className={f.team.radiantGold >= 0 ? 'tone-good' : 'tone-bad'}>
                        {f.team.radiantGold >= 0 ? '+' : ''}
                        {f.team.radiantGold}
                      </span>
                      <span className="moment-mid-label">золото</span>
                      <span className={f.team.direGold >= 0 ? 'tone-good' : 'tone-bad'}>
                        {f.team.direGold >= 0 ? '+' : ''}
                        {f.team.direGold}
                      </span>
                    </div>
                    <div className="moment-mid-row">
                      <span className={f.team.radiantXp >= 0 ? 'tone-good' : 'tone-bad'}>
                        {f.team.radiantXp >= 0 ? '+' : ''}
                        {f.team.radiantXp}
                      </span>
                      <span className="moment-mid-label">опыт</span>
                      <span className={f.team.direXp >= 0 ? 'tone-good' : 'tone-bad'}>
                        {f.team.direXp >= 0 ? '+' : ''}
                        {f.team.direXp}
                      </span>
                    </div>
                    <div className="moment-mid-row">
                      <span className="tone-mid">{f.team.radiantDmg}</span>
                      <span className="moment-mid-label">урон</span>
                      <span className="tone-mid">{f.team.direDmg}</span>
                    </div>
                    <div className="moment-mid-row">
                      <span
                        className={
                          f.team.radiantDeaths > f.team.direDeaths
                            ? 'tone-bad'
                            : 'tone-good'
                        }
                      >
                        {f.team.radiantDeaths}
                      </span>
                      <span className="moment-mid-label">смерти</span>
                      <span
                        className={
                          f.team.direDeaths > f.team.radiantDeaths
                            ? 'tone-bad'
                            : 'tone-good'
                        }
                      >
                        {f.team.direDeaths}
                      </span>
                    </div>
                  </div>

                  <div className="moment-col dire">
                    <div className="moment-col-title">Силы Тьмы</div>
                    {dire.map((r) => (
                      <FightHero key={r.player.player.player_slot} r={r} />
                    ))}
                    {dire.length === 0 && (
                      <div className="hint">Почти не участвовали</div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
