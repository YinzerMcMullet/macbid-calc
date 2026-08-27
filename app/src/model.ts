// Normalized domain model. Every platform adapter maps into these shapes so the
// UI never touches platform-specific payloads.

export type PlatformId = 'sleeper' | 'yahoo' | 'fleaflicker' | 'espn'

export interface SeasonState {
  season: string
  week: number // current NFL week (0 in preseason)
  seasonType: 'pre' | 'regular' | 'post'
}

export interface League {
  platform: PlatformId
  id: string
  name: string
  season: string
  totalTeams: number
  scoringLabel: string // e.g. "PPR", "Half PPR", "Custom"
  rosterPositions: string[] // starting slots, e.g. ["QB","RB","RB","WR","WR","TE","FLEX","DEF","K"]
  avatarUrl?: string
}

export interface Team {
  leagueId: string
  id: string
  ownerUserId?: string
  name: string
  avatarUrl?: string
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
  isMine: boolean
}

export interface Roster {
  leagueId: string
  teamId: string
  starters: string[] // player ids, aligned with league.rosterPositions
  bench: string[]
  reserve: string[] // IR
  taxi: string[]
}

export interface Matchup {
  leagueId: string
  week: number
  matchupKey: string // teams with the same key play each other
  teamId: string
  points: number
}

export interface Player {
  id: string
  name: string
  position: string
  team: string | null
  injuryStatus: string | null
}
