// FantasyCalc trade values — free, no auth, CORS-open. Refreshed at most every
// 12h per format (spec: values must be live/daily, so cache but not longer).

export interface ValueEntry {
  name: string
  position: string
  team: string | null
  sleeperId: string | null
  value: number
  overallRank: number
  positionRank: number
  trend30Day: number
}

export interface ValueFormat {
  dynasty: boolean
  superflex: boolean
}

const TTL_MS = 12 * 60 * 60 * 1000

interface FcRecord {
  player: { name: string; position: string; maybeTeam: string | null; sleeperId: string | null }
  value: number
  overallRank: number
  positionRank: number
  trend30Day: number
}

export async function getValues(fmt: ValueFormat): Promise<ValueEntry[]> {
  const key = `ffcc:fc:${fmt.dynasty ? 'dyn' : 'red'}:${fmt.superflex ? 'sf' : '1qb'}`
  try {
    const cached = localStorage.getItem(key)
    if (cached) {
      const { at, entries } = JSON.parse(cached) as { at: number; entries: ValueEntry[] }
      if (Date.now() - at < TTL_MS) return entries
    }
  } catch {
    // ignore cache errors
  }
  const url = `https://api.fantasycalc.com/values/current?isDynasty=${fmt.dynasty}&numQbs=${fmt.superflex ? 2 : 1}&numTeams=12&ppr=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FantasyCalc failed: ${res.status}`)
  const raw = (await res.json()) as FcRecord[]
  const entries: ValueEntry[] = raw.map((r) => ({
    name: r.player.name,
    position: r.player.position,
    team: r.player.maybeTeam ?? null,
    sleeperId: r.player.sleeperId ?? null,
    value: r.value,
    overallRank: r.overallRank,
    positionRank: r.positionRank,
    trend30Day: r.trend30Day,
  }))
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), entries }))
  } catch {
    // storage full/blocked — fine, we just refetch next time
  }
  return entries
}
