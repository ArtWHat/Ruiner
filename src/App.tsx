import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { goldTips, xpTips } from './analysis/curveTips'
import { analyzeMatch } from './analysis/score'
import {
  fetchHeroes,
  fetchMatch,
  formatMatchError,
  getHero,
  heroImageUrl,
  peekHistoryRuiner,
} from './api/opendota'
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
import { applyShareMeta, matchShareUrl, parseMatchQuery } from './share'
import type { MatchAnalysis, PlayerAnalysis } from './types'

type ChartTab = 'gold' | 'xp' | 'build' | 'impact'

type HistoryEntry = {
  matchId: number
  heroId?: number
  heroName: string
  heroImage: string
  displayName: string
}

const HISTORY_KEY = 'ruiner-match-history'

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x): HistoryEntry | null => {
        if (typeof x === 'number' && Number.isFinite(x) && x > 0) {
          return {
            matchId: x,
            heroName: '—',
            heroImage: '',
            displayName: 'Матч',
          }
        }
        if (
          x &&
          typeof x === 'object' &&
          Number.isFinite((x as HistoryEntry).matchId)
        ) {
          const e = x as HistoryEntry
          return {
            matchId: e.matchId,
            heroId: e.heroId,
            heroName: e.heroName || '—',
            heroImage: e.heroImage || '',
            displayName: e.displayName || 'Anonymous',
          }
        }
        return null
      })
      .filter((x): x is HistoryEntry => !!x)
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 8)))
}

function needsHistoryArt(e: HistoryEntry): boolean {
  return !e.heroImage || e.heroName === '—' || !e.heroId
}

function fillFromHeroId(e: HistoryEntry): HistoryEntry {
  if (!e.heroId) return e
  const hero = getHero(e.heroId)
  if (!hero) return e
  return {
    ...e,
    heroName: e.heroName === '—' ? hero.localized_name : e.heroName,
    heroImage: e.heroImage || heroImageUrl(hero),
  }
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
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [modal, setModal] = useState<'moments' | 'draft' | null>(null)
  const [shareFlash, setShareFlash] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bootedRef = useRef(false)

  useEffect(() => {
    const base = loadHistory()
    setHistory(base)

    ;(async () => {
      // Сначала даём приоритет анализу матча из ?m=, историю — после паузы
      if (parseMatchQuery()) {
        await new Promise((r) => window.setTimeout(r, 2500))
      }
      try {
        await fetchHeroes()
      } catch {
        return
      }

      let current = base.map(fillFromHeroId)
      if (current.some((e, i) => e.heroImage !== base[i]?.heroImage)) {
        setHistory([...current])
        saveHistory(current)
      }

      for (let i = 0; i < current.length; i++) {
        if (!needsHistoryArt(current[i])) continue
        try {
          const peeked = await peekHistoryRuiner(current[i].matchId)
          if (!peeked) continue
          current = current.map((e, idx) =>
            idx === i
              ? {
                  matchId: peeked.matchId,
                  heroId: peeked.heroId,
                  heroName: peeked.heroName,
                  heroImage: peeked.heroImage,
                  displayName: peeked.displayName,
                }
              : e,
          )
          setHistory([...current])
          saveHistory(current)
          await new Promise((r) => window.setTimeout(r, 350))
        } catch {
          // следующий матч
        }
      }
    })()
  }, [])

  // Автозапуск по ?m=… (без abort на unmount — иначе Strict Mode рвёт запрос)
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    const id = parseMatchQuery()
    if (id) {
      queueMicrotask(() => {
        void runAnalysis(id)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (analysis) applyShareMeta(analysis)
  }, [analysis])

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
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    setAnalysis(null)
    setSelected(null)
    setMatchId('')
    setStatus('')
    setError(false)
    setRankMedal(null)
    setTab('gold')
    setModal(null)
    setShareFlash(false)
    document.title = 'Ruiner — анализ матча Dota 2'
    const url = new URL(window.location.href)
    url.search = ''
    window.history.replaceState({}, '', url.pathname)
  }

  function cancelAnalysis() {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    setError(false)
    setStatus('Поиск остановлен')
  }

  async function runAnalysis(id: number) {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setMatchId(String(id))
    setLoading(true)
    setError(false)
    setStatus('')
    setShareFlash(false)
    setAnalysis(null)
    setSelected(null)
    setRankMedal(null)
    const url = new URL(window.location.href)
    url.searchParams.set('m', String(id))
    window.history.replaceState({}, '', `${url.pathname}?m=${id}`)
    try {
      const { match, players } = await fetchMatch(id, ac.signal)
      if (ac.signal.aborted) return
      const result = analyzeMatch(match, players)
      setAnalysis(result)
      setSelected(result.ruiner)
      setTab('gold')
      setStatus('')
      const entry: HistoryEntry = {
        matchId: id,
        heroId: result.ruiner.player.hero_id,
        heroName: result.ruiner.heroName,
        heroImage: result.ruiner.heroImage,
        displayName: result.ruiner.displayName,
      }
      const next = [entry, ...loadHistory().filter((x) => x.matchId !== id)]
      saveHistory(next)
      setHistory(next)
    } catch (err) {
      if (ac.signal.aborted) return
      setError(true)
      setStatus(formatMatchError(err))
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      setLoading(false)
    }
  }

  async function onShare() {
    if (!analysis) return
    try {
      await navigator.clipboard.writeText(matchShareUrl(analysis.matchId))
      setShareFlash(true)
      window.setTimeout(() => setShareFlash(false), 900)
    } catch {
      setShareFlash(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) {
      cancelAnalysis()
      return
    }
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
          required={!loading}
          disabled={loading}
        />
        <button
          type="submit"
          className={loading ? 'search-busy' : ''}
          title={loading ? 'Остановить поиск' : 'Анализировать'}
        >
          {loading ? <span className="spin" aria-label="Загрузка" /> : 'АНАЛИЗИРОВАТЬ'}
        </button>
      </form>

      {!analysis && !loading && history.length > 0 && (
        <div className="history">
          <div className="history-label">История поиска</div>
          <div className="history-row">
            {history.map((h) => (
              <button
                key={h.matchId}
                type="button"
                className="history-card"
                onClick={() => runAnalysis(h.matchId)}
              >
                <div className="history-id">{h.matchId}</div>
                <div className="history-ruiner">
                  {h.heroImage ? (
                    <img
                      key={h.heroImage}
                      src={h.heroImage}
                      alt={h.heroName}
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="history-ph" />
                  )}
                  <div className="history-ruiner-meta">
                    <span className="history-badge">Руинер</span>
                    <span className="history-hero">{h.heroName}</span>
                    <span className="history-player">{h.displayName}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && status && (
        <div className="status error">{status}</div>
      )}
      {!error && status && !analysis && (
        <div className="status">{status}</div>
      )}
      {analysis && !loading && !error && (
        <>
          <div className="match-pills" aria-label="Информация о матче">
            <span className="match-pill">Матч {analysis.matchId}</span>
            <span className="match-pill">{durationLabel(analysis.duration)}</span>
            <span className="match-pill">
              Победа {analysis.radiantWin ? 'Света' : 'Тьмы'}
            </span>
            <span className="match-pill type">{analysis.matchType}</span>
          </div>
          <div className="share-row">
            <button
              type="button"
              className={`share-btn${shareFlash ? ' flash' : ''}`}
              onClick={() => void onShare()}
            >
              <span className="share-ico" aria-hidden>
                ↗
              </span>
              Поделиться
            </button>
          </div>
        </>
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
