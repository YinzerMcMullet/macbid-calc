import { useEffect, useMemo, useState } from 'react'
import type { League, Matchup, Player, Roster, SeasonState, Team } from './model'
import { PLATFORMS } from './config'

interface LeagueBundle {
  league: League
  teams: Team[]
  rosters: Roster[]
  matchups: Matchup[]
}

const HANDLE_KEY = 'ffcc:sleeper:handle'

export default function App() {
  const [handle, setHandle] = useState<string>(() => localStorage.getItem(HANDLE_KEY) ?? '')
  const [input, setInput] = useState('')
  const [state, setState] = useState<SeasonState | null>(null)
  const [bundles, setBundles] = useState<LeagueBundle[] | null>(null)
  const [players, setPlayers] = useState<Map<string, Player> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loading = !!handle && !bundles && !error

  useEffect(() => {
    if (!handle) return
    let cancelled = false
    const platform = PLATFORMS.find((p) => p.id === 'sleeper')!
    const adapter = platform.create()
    ;(async () => {
      const season = await adapter.getSeasonState()
      const leagues = await adapter.getLeagues(handle, season.season)
      const week = Math.max(season.week, 1)
      const data = await Promise.all(
        leagues.map(async (league) => {
          const [teams, rosters, matchups] = await Promise.all([
            adapter.getTeams(league.id),
            adapter.getRosters(league.id),
            adapter.getMatchups(league.id, week).catch(() => []),
          ])
          return { league, teams, rosters, matchups }
        }),
      )
      if (cancelled) return
      setState(season)
      setBundles(data)
      // player names load after the dashboard renders — it's the slow call
      adapter.getPlayers().then((m) => !cancelled && setPlayers(m)).catch(() => {})
    })().catch((e: unknown) => {
      if (cancelled) return
      setError(e instanceof Error ? e.message : String(e))
    })
    return () => {
      cancelled = true
    }
  }, [handle])

  const connect = () => {
    const h = input.trim()
    if (!h) return
    localStorage.setItem(HANDLE_KEY, h)
    setBundles(null)
    setError(null)
    setHandle(h)
  }

  const disconnect = () => {
    localStorage.removeItem(HANDLE_KEY)
    setHandle('')
    setBundles(null)
    setError(null)
    setSelected(null)
  }

  const current = bundles?.find((b) => b.league.id === selected) ?? null

  return (
    <div className="mx-auto max-w-xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between bg-surface/90 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold">
          {current ? (
            <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-accent">
              <span aria-hidden>←</span> {current.league.name}
            </button>
          ) : (
            <span>🏈 Command Center</span>
          )}
        </h1>
        {handle && !current && (
          <button onClick={disconnect} className="text-xs text-gray-400">
            {handle} ✕
          </button>
        )}
      </header>

      {!handle && (
        <div className="mt-16 flex flex-col gap-3">
          <p className="text-center text-gray-300">Pull all your leagues into one dashboard.</p>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && connect()}
            placeholder="Sleeper username"
            autoCapitalize="none"
            autoCorrect="off"
            className="rounded-xl bg-surface-2 px-4 py-3 text-base outline-none ring-accent focus:ring-2"
          />
          <button onClick={connect} className="rounded-xl bg-accent py-3 font-semibold text-black active:opacity-80">
            Connect Sleeper
          </button>
          <p className="text-center text-xs text-gray-500">Yahoo, Fleaflicker, and ESPN are coming next.</p>
        </div>
      )}

      {error && <p className="rounded-lg bg-loss/10 p-3 text-sm text-loss">{error}</p>}
      {loading && <p className="animate-pulse py-8 text-center text-gray-400">Loading leagues…</p>}

      {handle && bundles && !current && (
        <main className="flex flex-col gap-3">
          {state && (
            <p className="text-xs tracking-wide text-gray-400 uppercase">
              {state.season} · {state.seasonType === 'pre' ? 'Preseason' : `Week ${state.week}`} · {bundles.length}{' '}
              {bundles.length === 1 ? 'league' : 'leagues'}
            </p>
          )}
          {bundles.length === 0 && <p className="py-8 text-center text-gray-400">No leagues found for this season.</p>}
          {bundles.map((b) => (
            <LeagueCard key={b.league.id} bundle={b} onOpen={() => setSelected(b.league.id)} />
          ))}
        </main>
      )}

      {current && <LeagueDetail bundle={current} players={players} />}
    </div>
  )
}

function myTeam(b: LeagueBundle): Team | undefined {
  return b.teams.find((t) => t.isMine)
}

function record(t: Team): string {
  return t.ties ? `${t.wins}-${t.losses}-${t.ties}` : `${t.wins}-${t.losses}`
}

function LeagueCard({ bundle, onOpen }: { bundle: LeagueBundle; onOpen: () => void }) {
  const me = myTeam(bundle)
  const opp = useMemo(() => {
    if (!me) return undefined
    const mine = bundle.matchups.find((m) => m.teamId === me.id)
    if (!mine) return undefined
    const other = bundle.matchups.find((m) => m.matchupKey === mine.matchupKey && m.teamId !== me.id)
    return other ? bundle.teams.find((t) => t.id === other.teamId) : undefined
  }, [bundle, me])

  return (
    <button onClick={onOpen} className="rounded-2xl bg-surface-2 p-4 text-left active:bg-surface-3">
      <div className="flex items-center gap-3">
        {bundle.league.avatarUrl ? (
          <img src={bundle.league.avatarUrl} alt="" className="h-10 w-10 rounded-lg" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-3">🏈</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{bundle.league.name}</p>
          <p className="text-xs text-gray-400">
            {bundle.league.totalTeams}-team · {bundle.league.scoringLabel}
          </p>
        </div>
        {me && <span className="text-sm font-semibold text-gray-300">{record(me)}</span>}
      </div>
      {me && opp && (
        <p className="mt-2 text-xs text-gray-400">
          This week: <span className="text-gray-200">{me.name}</span> vs <span className="text-gray-200">{opp.name}</span>
        </p>
      )}
    </button>
  )
}

function LeagueDetail({ bundle, players }: { bundle: LeagueBundle; players: Map<string, Player> | null }) {
  const [tab, setTab] = useState<'matchups' | 'standings' | 'roster'>('matchups')
  const me = myTeam(bundle)

  return (
    <main>
      <nav className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {(['matchups', 'standings', 'roster'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-sm font-medium capitalize ${tab === t ? 'bg-surface-3 text-white' : 'text-gray-400'}`}
          >
            {t === 'roster' ? 'My Team' : t}
          </button>
        ))}
      </nav>

      {tab === 'standings' && <Standings teams={bundle.teams} />}
      {tab === 'matchups' && <Matchups bundle={bundle} />}
      {tab === 'roster' && (me ? <RosterView bundle={bundle} team={me} players={players} /> : <p className="text-gray-400">Couldn't find your team in this league.</p>)}
    </main>
  )
}

function Standings({ teams }: { teams: Team[] }) {
  const sorted = [...teams].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)
  return (
    <ol className="flex flex-col gap-1">
      {sorted.map((t, i) => (
        <li key={t.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${t.isMine ? 'bg-accent/10' : 'bg-surface-2'}`}>
          <span className="w-5 text-right text-xs text-gray-500">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
          <span className="text-sm font-semibold">{record(t)}</span>
          <span className="w-16 text-right text-xs text-gray-400">{t.pointsFor.toFixed(1)}</span>
        </li>
      ))}
    </ol>
  )
}

function Matchups({ bundle }: { bundle: LeagueBundle }) {
  const teamById = new Map(bundle.teams.map((t) => [t.id, t]))
  const pairs = new Map<string, Matchup[]>()
  for (const m of bundle.matchups) {
    pairs.set(m.matchupKey, [...(pairs.get(m.matchupKey) ?? []), m])
  }
  if (pairs.size === 0) return <p className="py-8 text-center text-sm text-gray-400">No matchups yet — check back when the week starts.</p>
  return (
    <div className="flex flex-col gap-2">
      {[...pairs.values()].map((pair) => (
        <div key={pair[0].matchupKey} className="rounded-xl bg-surface-2 p-3">
          {pair.map((m) => {
            const t = teamById.get(m.teamId)
            return (
              <div key={m.teamId} className={`flex items-center justify-between py-1 ${t?.isMine ? 'text-accent' : ''}`}>
                <span className="min-w-0 flex-1 truncate text-sm">{t?.name ?? m.teamId}</span>
                <span className="text-sm font-semibold tabular-nums">{m.points.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function PlayerRow({ id, slot, players }: { id: string; slot?: string; players: Map<string, Player> | null }) {
  const p = players?.get(id)
  return (
    <li className="flex items-center gap-3 py-1.5">
      {slot && <span className="w-12 shrink-0 text-xs font-semibold text-gray-500">{slot}</span>}
      <span className="min-w-0 flex-1 truncate text-sm">{p ? p.name : players ? id : '…'}</span>
      {p?.injuryStatus && <span className="text-xs text-loss">{p.injuryStatus}</span>}
      <span className="text-xs text-gray-400">
        {p ? `${p.position}${p.team ? ` · ${p.team}` : ''}` : ''}
      </span>
    </li>
  )
}

function RosterView({ bundle, team, players }: { bundle: LeagueBundle; team: Team; players: Map<string, Player> | null }) {
  const roster = bundle.rosters.find((r) => r.teamId === team.id)
  if (!roster) return <p className="text-gray-400">No roster data.</p>
  const slots = bundle.league.rosterPositions
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">Starters</h3>
        <ul className="rounded-xl bg-surface-2 px-3 py-1">
          {roster.starters.map((id, i) => (
            <PlayerRow key={`${id}-${i}`} id={id} slot={slots[i] ?? 'FLEX'} players={players} />
          ))}
        </ul>
      </section>
      {roster.bench.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">Bench</h3>
          <ul className="rounded-xl bg-surface-2 px-3 py-1">
            {roster.bench.map((id) => (
              <PlayerRow key={id} id={id} players={players} />
            ))}
          </ul>
        </section>
      )}
      {roster.reserve.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">IR</h3>
          <ul className="rounded-xl bg-surface-2 px-3 py-1">
            {roster.reserve.map((id) => (
              <PlayerRow key={id} id={id} players={players} />
            ))}
          </ul>
        </section>
      )}
      {roster.taxi.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">Taxi</h3>
          <ul className="rounded-xl bg-surface-2 px-3 py-1">
            {roster.taxi.map((id) => (
              <PlayerRow key={id} id={id} players={players} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
