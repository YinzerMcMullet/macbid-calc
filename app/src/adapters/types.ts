import type { League, Matchup, Player, Roster, SeasonState, Team } from '../model'

// Contract every fantasy platform integration implements. Adapters are looked
// up from config (see src/config.ts) — the UI and stores stay platform-agnostic.
export interface PlatformAdapter {
  platform: string
  // Resolve a platform-specific handle (username, email, guid) to leagues.
  getLeagues(handle: string, season: string): Promise<League[]>
  getTeams(leagueId: string): Promise<Team[]>
  getRosters(leagueId: string): Promise<Roster[]>
  getMatchups(leagueId: string, week: number): Promise<Matchup[]>
  getSeasonState(): Promise<SeasonState>
  // Player metadata for id -> name/pos/team lookups. Implementations are
  // expected to cache aggressively (Sleeper's dump is ~5MB, max 1 fetch/day).
  getPlayers(): Promise<Map<string, Player>>
}
