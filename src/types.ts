export type Role = 'carry' | 'mid' | 'offlane' | 'soft' | 'hard'

export type Grade = 'плохо' | 'средне' | 'хорошо'

export type Tone = 'good' | 'bad' | 'mid'

export interface PurchaseEvent {
  time: number
  key: string
}

export interface KillLogEvent {
  time: number
  key: string
}

export interface TeamfightPlayer {
  deaths?: number
  damage?: number
  healing?: number
  gold_delta?: number
  xp_delta?: number
}

export interface Teamfight {
  start: number
  end: number
  deaths?: number[]
  players: TeamfightPlayer[]
}

export interface MatchPlayer {
  account_id?: number
  personaname?: string
  hero_id: number
  player_slot: number
  kills: number
  deaths: number
  assists: number
  gold_per_min: number
  xp_per_min: number
  level: number
  net_worth?: number
  gold_t?: number[]
  xp_t?: number[]
  purchase_log?: PurchaseEvent[]
  kills_log?: KillLogEvent[]
  lane_role?: number
  rank_tier?: number
  hero_damage?: number
  tower_damage?: number
  isRadiant: boolean
  win: boolean
}

export interface OpenDotaMatch {
  match_id: number
  duration: number
  radiant_win: boolean
  teamfights?: Teamfight[]
  radiant_gold_adv?: number[]
  radiant_xp_adv?: number[]
  players: Array<{
    account_id?: number
    personaname?: string
    hero_id: number
    player_slot: number
    kills: number
    deaths: number
    assists: number
    gold_per_min: number
    xp_per_min: number
    level: number
    net_worth?: number
    gold_t?: number[]
    xp_t?: number[]
    purchase_log?: PurchaseEvent[]
    kills_log?: KillLogEvent[]
    lane_role?: number
    rank_tier?: number
    hero_damage?: number
    tower_damage?: number
  }>
}

export interface HeroMeta {
  id: number
  name: string
  localized_name: string
  roles?: string[]
}

export interface ImpactEvent {
  minute: number
  title: string
  detail: string
  tone: Tone
}

export interface SummaryBit {
  text: string
  tone: Tone
}

export interface PlayerAnalysis {
  player: MatchPlayer
  heroName: string
  heroImage: string
  displayName: string
  role: Role
  grade: Grade
  score: number
  /** Импакт к ожиданию по роли: 100% = норма, >100% сильнее ожидания */
  impactPct: number
  expectedGpm: number
  expectedXpm: number
  goldActual: number[]
  goldExpected: number[]
  xpActual: number[]
  xpExpected: number[]
  itemFacts: Array<{ key: string; minute: number; label: string }>
  itemTargets: Array<{ key: string; minute: number; label: string; why?: string }>
  /** Все крупные покупки по факту (для таймлайна) */
  itemTimeline: Array<{ key: string; minute: number; label: string }>
  reasons: string[]
  summary: SummaryBit[]
  impactEvents: ImpactEvent[]
  goldLostOnDeaths: number
  overview: string
  build: import('./analysis/buildReview').BuildReview
}

export interface MatchAnalysis {
  matchId: number
  duration: number
  radiantWin: boolean
  players: PlayerAnalysis[]
  ruiner: PlayerAnalysis
  mvp: PlayerAnalysis
  teamfights: Teamfight[]
  radiantGoldAdv: number[]
  radiantXpAdv: number[]
}
