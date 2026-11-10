import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { goldTips, xpTips } from './analysis/curveTips'
import { analyzeMatch } from './analysis/score'
import { fetchMatch, formatMatchError } from './api/opendota'
import { BuildPanel } from './components/BuildPanel'
import { CompareChart } from './components/CompareChart'
import { CurveAdvice } from './components/CurveAdvice'
import { DraftModal } from './components/DraftModal'
import { ImpactPanel } from './components/ImpactPanel'
import { Kda, toneClass } from './components/Kda'
import { MomentsModal } from './components/MomentsModal'
import { RankIcon } from './components/RankIcon'
import { RankPicker } from './components/RankPicker'
import { TeamList } from './components/TeamList'
import { RANK_CURVE_MULT, scaleSeries } from './data/ranks'
import { applyShareMeta, copyShareLink, parseMatchQuery } from './share'
import type { MatchAnalysis, PlayerAnalysis } from './types'

type ChartTab = 'gold' | 'xp' | 'build' | 'impact'

const HISTORY_KEY = 'ruiner-match-history'

function loadHistory(): number[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as number[]
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isFinite(n)) : []
  } catch {
    return []
  }
}

function saveHistory(ids: number[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(ids.slice(0, 8)))
}

export default function App() {
  const [matchId, setMatchId] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState(false)
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null)
  const [selected, setSelected] = useState<PlayerAnalysis | null>(null)
  const [tab, setTab] = useState<ChartTab>('gold')
  const [rankMedal, setRankMedal] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [modal, setModal] = useState<'moments' | 'draft' | null>(null)
  const [shareHint, setShareHint] = useState('')
  const bootRef = useRef(false)

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  useEffect(() => {
    if (bootRef.current) return
    bootRef.current = true
    const id = parseMatchQuery()
    if (id) void runAnalysis(id)
  }, [])

  useEffect(() => {
    if (analysis) applyShareMeta(analysis)
  }, [analysis])

  const durationMin = useMemo(
    () => (analysis ? Math.floor(analysis.duration / 60) : 0),
    [analysis],
  )

  const rankGold = useMemo(() => {
    if (!selected || !rankMedal) return null
    return scaleSeries(selected.goldExpected, RANK_CURVE_MULT[rankMedal] ?? 1)
  }, [selected, rankMedal])

  const rankXp = useMemo(() => {
    if (!selected || !rankMedal) return null
    return scaleSeries(selected.xpExpected, RANK_CURVE_MULT[rankMedal] ?? 1)
  }, [selected, rankMedal])

  const gTips = useMemo(
    () => (selected ? goldTips(selected) : []),
    [selected],
  )
  const xTips = useMemo(() => (selected ? xpTips(selected) : []), [selected])

  function selectPlayer(p: PlayerAnalysis, nextTab?: ChartTab) {
    setSelected(p)
    if (nextTab) setTab(nextTab)
  }

  function goHome() {
    setAnalysis(null)
    setSelected(null)
    setMatchId('')
    setStatus('')
    setError(false)
    setRankMedal(null)
    setTab('gold')
    setModal(null)
    setShareHint('')
    document.title = 'Ruiner — анализ матча Dota 2'
    const url = new URL(window.location.href)
    url.search = ''
    window.history.replaceState({}, '', url.pathname)
  }

  async function runAnalysis(id: number) {
    setMatchId(String(id))
    setLoading(true)
    setError(false)
    setStatus('Загружаю информацию…')
    setShareHint('')
    setAnalysis(null)
    setSelected(null)
    setRankMedal(null)
    const url = new URL(window.location.href)
    url.searchParams.set('m', String(id))
    window.history.replaceState({}, '', `${url.pathname}?m=${id}`)
    try {
      const { match, players } = await fetchMatch(id)
      const result = analyzeMatch(match, players)
      setAnalysis(result)
      setSelected(result.ruiner)
      setTab('gold')
      setStatus(
        `Матч ${result.matchId} · ${durationLabel(result.duration)} · победа ${
          result.radiantWin ? 'Света' : 'Тьмы'
        }`,
      )
      const next = [id, ...loadHistory().filter((x) => x !== id)]
      saveHistory(next)
      setHistory(next)
    } catch (err) {
      setError(true)
      setStatus(formatMatchError(err))
    } finally {
      setLoading(false)
    }
  }

  async function onShare() {
    if (!analysis) return
    const res = await copyShareLink(analysis)
    setShareHint(
      res === 'shared'
        ? 'Отправлено'
        : res === 'copied'
          ? 'Ссылка скопирована'
          : 'Не удалось поделиться',
    )
    window.setTimeout(() => setShareHint(''), 2500)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const id = Number(matchId.trim())
    if (!Number.isFinite(id) || id <= 0) {
      setError(true)
      setStatus('Введи корректный Match ID')
      return
    }
    await runAnalysis(id)
  }

  return (
    <div className="app">
      <header className="brand">
        <button type="button" className="brand-btn" onClick={goHome}>
          RUINER
        </button>
      </header>

      <form className="search" onSubmit={onSubmit}>
        <input
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
          placeholder="Введи Match ID"
          inputMode="numeric"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? '…' : 'АНАЛИЗИРОВАТЬ'}
        </button>
      </form>

      {!analysis && history.length > 0 && (
        <div className="history">
          <div className="history-label">История поиска</div>
          <div className="history-row">
            {history.map((id) => (
              <button
                key={id}
                type="button"
                className="history-chip"
                disabled={loading}
                onClick={() => runAnalysis(id)}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-block">
          <div className="loading-label">Загружаю информацию…</div>
          <div className="loading-bar">
            <i />
          </div>
        </div>
      )}
      {!loading && status && (
        <div className={`status${error ? ' error' : ''}`}>{status}</div>
      )}
      {analysis && !loading && !error && (
        <div className="share-row">
          <button type="button" className="share-btn" onClick={() => void onShare()}>
            <span className="share-ico" aria-hidden>
              ↗
            </span>
            Поделиться
          </button>
          {shareHint && <span className="share-hint">{shareHint}</span>}
        </div>
      )}

      {analysis && selected && (
        <>
          <div className="spotlight">
            <Spotlight
              kind="ruiner"
              player={analysis.ruiner}
              active={selected === analysis.ruiner}
              onClick={() => selectPlayer(analysis.ruiner, 'impact')}
            />
            <Spotlight
              kind="mvp"
              player={analysis.mvp}
              active={selected === analysis.mvp}
              onClick={() => selectPlayer(analysis.mvp, 'impact')}
            />
          </div>

          <div className="mid-actions">
            <button
              type="button"
              className="mid-chip"
              onClick={() => setModal('moments')}
            >
              Решающие моменты
            </button>
            <button
              type="button"
              className="mid-chip"
              onClick={() => setModal('draft')}
            >
              Драфт
            </button>
          </div>

          <div className="layout">
            <TeamList
              analysis={analysis}
              selected={selected}
              onSelect={(p) => selectPlayer(p)}
            />

            <div className="panel charts">
              <div className="kpi">
                <div>
                  <span>KDA </span>
                  <Kda
                    kills={selected.player.kills}
                    deaths={selected.player.deaths}
                    assists={selected.player.assists}
                    role={selected.role}
                  />
                </div>
                <div>
                  <span>GPM </span>
                  <strong
                    className={toneClass(
                      selected.player.gold_per_min,
                      selected.expectedGpm,
                    )}
                  >
                    {selected.player.gold_per_min}
                  </strong>
                  <span> / ожид. {selected.expectedGpm}</span>
                </div>
                <div>
                  <span>XPM </span>
                  <strong
                    className={toneClass(
                      selected.player.xp_per_min,
                      selected.expectedXpm,
                    )}
                  >
                    {selected.player.xp_per_min}
                  </strong>
                  <span> / ожид. {selected.expectedXpm}</span>
                </div>
                <div>
                  <span>Длительность </span>
                  <strong>{durationMin} мин</strong>
                </div>
                <div>
                  <span>Импакт </span>
                  <strong
                    className={
                      selected.impactPct >= 80
                        ? 'tone-good'
                        : selected.impactPct < 50
                          ? 'tone-bad'
                          : 'tone-mid'
                    }
                  >
                    {selected.impactPct}%
                  </strong>
                </div>
                <div className="kpi-rank">
                  <RankIcon rankTier={selected.player.rank_tier} size={24} />
                </div>
              </div>

              <div className="chart-tabs">
                <button
                  type="button"
                  className={tab === 'gold' ? 'active' : ''}
                  onClick={() => setTab('gold')}
                >
                  ЗОЛОТО
                </button>
                <button
                  type="button"
                  className={tab === 'xp' ? 'active' : ''}
                  onClick={() => setTab('xp')}
                >
                  ОПЫТ
                </button>
                <button
                  type="button"
                  className={tab === 'build' ? 'active' : ''}
                  onClick={() => setTab('build')}
                >
                  BUILD
                </button>
                <button
                  type="button"
                  className={tab === 'impact' ? 'active' : ''}
                  onClick={() => setTab('impact')}
                >
                  ВКЛАД
                </button>
              </div>

              {tab === 'gold' && (
                <>
                  <CompareChart
                    actual={selected.goldActual}
                    expected={selected.goldExpected}
                    rankSeries={rankGold}
                    rankLabel="Среднее выбранного ранга"
                    actualLabel="Золото факт"
                    expectedLabel="Золото ожидание"
                    color="#e0a14a"
                  />
                  <RankPicker value={rankMedal} onChange={setRankMedal} />
                  <CurveAdvice tips={gTips} />
                </>
              )}
              {tab === 'xp' && (
                <>
                  <CompareChart
                    actual={selected.xpActual}
                    expected={selected.xpExpected}
                    rankSeries={rankXp}
                    rankLabel="Среднее выбранного ранга"
                    actualLabel="Опыт факт"
                    expectedLabel="Опыт ожидание"
                    color="#5b8def"
                  />
                  <RankPicker value={rankMedal} onChange={setRankMedal} />
                  <CurveAdvice tips={xTips} />
                </>
              )}
              {tab === 'build' && <BuildPanel player={selected} />}
              {tab === 'impact' && <ImpactPanel player={selected} />}
            </div>
          </div>

          {modal === 'moments' && (
            <MomentsModal analysis={analysis} onClose={() => setModal(null)} />
          )}
          {modal === 'draft' && (
            <DraftModal analysis={analysis} onClose={() => setModal(null)} />
          )}
        </>
      )}
    </div>
  )
}

function durationLabel(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function Spotlight({
  kind,
  player,
  active,
  onClick,
}: {
  kind: 'ruiner' | 'mvp'
  player: PlayerAnalysis
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`card big ${active ? `active-${kind}` : ''}`}
      onClick={onClick}
    >
      <div className="card-left">
        <img className="hero-art" src={player.heroImage} alt={player.heroName} />
        <div className="card-hero-meta">
          <div className="card-hero-name">{player.heroName}</div>
          <div className="card-hero-lvl">{player.player.level} ЛВЛ</div>
          <RankIcon rankTier={player.player.rank_tier} size={80} />
        </div>
      </div>

      <div className="meta">
        <div className="card-top name-row">
          <div className="name-badge">
            <h3>{player.displayName}</h3>
            <span className={`badge ${kind}`}>
              {kind === 'ruiner' ? 'Руинер' : 'MVP матча'}
            </span>
          </div>
          <div className={`pct-block ${kind}`}>
            <span className="pct">{player.impactPct}%</span>
            <span className="pct-label">импакт</span>
          </div>
        </div>

        <div className="stats line">
          <Kda
            kills={player.player.kills}
            deaths={player.player.deaths}
            assists={player.player.assists}
            role={player.role}
          />
          <span
            className={toneClass(
              player.player.gold_per_min,
              player.expectedGpm,
            )}
          >
            GPM {player.player.gold_per_min}
          </span>
          <span className={`grade ${player.grade}`}>{player.grade}</span>
        </div>

        <p className="card-overview">
          {player.overview.split(/(?<=\.)\s+/).slice(0, 2).join(' ')}
        </p>

        <div className="card-summary col">
          {player.summary.slice(0, 2).map((s) => (
            <span key={s.text} className={`chip tone-${s.tone}`}>
              {s.text}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}
