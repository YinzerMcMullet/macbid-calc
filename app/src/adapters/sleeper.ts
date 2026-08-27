import type { League, Matchup, Player, Roster, SeasonState, Team } from '../model'
import type { PlatformAdapter } from './types'
import { idbGet, idbSet } from '../lib/idb'

const BASE = 'https://api.sleeper.app/v1'
const AVATAR = 'https://sleepercdn.com/avatars/thumbs'
const PLAYERS_CACHE_KEY = 'sleeper:players'
const PLAYERS_TTL_MS = 24 * 60 * 60 * 1000 // Sleeper docs: fetch the dump at most once/day

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`Sleeper ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

interface SleeperUser {
  user_id: string
  display_name: string
  avatar: string | null
}

interface SleeperLeague {
  league_id: string
  name: string
  season: string
  total_rosters: number
  avatar: string | null
  roster_positions: string[]
  scoring_settings: Record<string, number>
}

interface SleeperRoster {
  roster_id: number
  owner_id: string | null
  starters: string[] | null
  players: string[] | null
  reserve: string[] | null
  taxi: string[] | null
  settings: {
    wins: number
    losses: number
    ties: number
    fpts?: number
    fpts_decimal?: number
    fpts_against?: number
    fpts_against_decimal?: number
  }
}

interface SleeperLeagueUser {
  user_id: string
  display_name: string
  avatar: string | null
  metadata?: { team_name?: string }
}

interface SleeperMatchup {
  roster_id: number
  matchup_id: number | null
  points: number
}

function scoringLabel(l: SleeperLeague): string {
  const rec = l.scoring_settings?.rec ?? 0
  let label = rec >= 1 ? 'PPR' : rec > 0 ? 'Half PPR' : 'Standard'
  if (l.roster_positions?.includes('SUPER_FLEX')) label += ' · SF'
  return label
}

function pts(whole: number | undefined, dec: number | undefined): number {
  return (whole ?? 0) + (dec ?? 0) / 100
}

export class SleeperAdapter implements PlatformAdapter {
  platform = 'sleeper'
  private myUserId: string | null = null

  async resolveUserId(handle: string): Promise<string> {
    const user = await get<SleeperUser | null>(`/user/${encodeURIComponent(handle)}`)
    if (!user?.user_id) throw new Error(`Sleeper user "${handle}" not found`)
    this.myUserId = user.user_id
    return user.user_id
  }

  async getSeasonState(): Promise<SeasonState> {
    const s = await get<{ season: string; week: number; season_type: string }>(`/state/nfl`)
    return {
      season: s.season,
      week: s.week,
      seasonType: s.season_type === 'pre' ? 'pre' : s.season_type === 'post' ? 'post' : 'regular',
    }
  }

  async getLeagues(handle: string, season: string): Promise<League[]> {
    const userId = await this.resolveUserId(handle)
    const leagues = await get<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`)
    return (leagues ?? []).map((l) => ({
      platform: 'sleeper' as const,
      id: l.league_id,
      name: l.name,
      season: l.season,
      totalTeams: l.total_rosters,
      scoringLabel: scoringLabel(l),
      rosterPositions: (l.roster_positions ?? []).filter((p) => p !== 'BN'),
      avatarUrl: l.avatar ? `${AVATAR}/${l.avatar}` : undefined,
    }))
  }

  async getTeams(leagueId: string): Promise<Team[]> {
    const [rosters, users] = await Promise.all([
      get<SleeperRoster[]>(`/league/${leagueId}/rosters`),
      get<SleeperLeagueUser[]>(`/league/${leagueId}/users`),
    ])
    const byUser = new Map(users.map((u) => [u.user_id, u]))
    return rosters.map((r) => {
      const owner = r.owner_id ? byUser.get(r.owner_id) : undefined
      return {
        leagueId,
        id: String(r.roster_id),
        ownerUserId: r.owner_id ?? undefined,
        name: owner?.metadata?.team_name || owner?.display_name || `Team ${r.roster_id}`,
        avatarUrl: owner?.avatar ? `${AVATAR}/${owner.avatar}` : undefined,
        wins: r.settings?.wins ?? 0,
        losses: r.settings?.losses ?? 0,
        ties: r.settings?.ties ?? 0,
        pointsFor: pts(r.settings?.fpts, r.settings?.fpts_decimal),
        pointsAgainst: pts(r.settings?.fpts_against, r.settings?.fpts_against_decimal),
        isMine: r.owner_id != null && r.owner_id === this.myUserId,
      }
    })
  }

  async getRosters(leagueId: string): Promise<Roster[]> {
    const rosters = await get<SleeperRoster[]>(`/league/${leagueId}/rosters`)
    return rosters.map((r) => {
      const starters = (r.starters ?? []).filter((p) => p && p !== '0')
      const all = new Set(r.players ?? [])
      for (const s of starters) all.delete(s)
      for (const p of r.reserve ?? []) all.delete(p)
      for (const p of r.taxi ?? []) all.delete(p)
      return {
        leagueId,
        teamId: String(r.roster_id),
        starters,
        bench: [...all],
        reserve: r.reserve ?? [],
        taxi: r.taxi ?? [],
      }
    })
  }

  async getMatchups(leagueId: string, week: number): Promise<Matchup[]> {
    const ms = await get<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`)
    return (ms ?? [])
      .filter((m) => m.matchup_id != null)
      .map((m) => ({
        leagueId,
        week,
        matchupKey: String(m.matchup_id),
        teamId: String(m.roster_id),
        points: m.points ?? 0,
      }))
  }

  async getPlayers(): Promise<Map<string, Player>> {
    const cached = await idbGet<{ at: number; players: Player[] }>(PLAYERS_CACHE_KEY)
    if (cached && Date.now() - cached.at < PLAYERS_TTL_MS) {
      return new Map(cached.players.map((p) => [p.id, p]))
    }
    // ~5MB dump — trimmed to the fields we render before caching
    const raw = await get<Record<string, { full_name?: string; first_name?: string; last_name?: string; position?: string; team?: string | null; injury_status?: string | null }>>(`/players/nfl`)
    const players: Player[] = Object.entries(raw).map(([id, p]) => ({
      id,
      name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || id,
      position: p.position || '?',
      team: p.team ?? null,
      injuryStatus: p.injury_status ?? null,
    }))
    try {
      await idbSet(PLAYERS_CACHE_KEY, { at: Date.now(), players })
    } catch {
      // cache failure is non-fatal (private browsing etc.)
    }
    return new Map(players.map((p) => [p.id, p]))
  }
}
