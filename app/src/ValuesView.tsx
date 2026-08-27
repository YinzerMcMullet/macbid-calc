import { useEffect, useState } from 'react'
import { getValues, type ValueEntry } from './values/fantasycalc'

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE'] as const

export default function ValuesView() {
  const [dynasty, setDynasty] = useState(false)
  const [superflex, setSuperflex] = useState(false)
  const [pos, setPos] = useState<(typeof POSITIONS)[number]>('ALL')
  const [results, setResults] = useState<Record<string, ValueEntry[] | { error: string }>>({})
  const fmtKey = `${dynasty}-${superflex}`
  const result = results[fmtKey]
  const entries = Array.isArray(result) ? result : null
  const error = result && !Array.isArray(result) ? result.error : null

  useEffect(() => {
    if (results[fmtKey]) return
    let cancelled = false
    getValues({ dynasty, superflex })
      .then((e) => !cancelled && setResults((prev) => ({ ...prev, [fmtKey]: e })))
      .catch(
        (e: unknown) =>
          !cancelled && setResults((prev) => ({ ...prev, [fmtKey]: { error: e instanceof Error ? e.message : String(e) } })),
      )
    return () => {
      cancelled = true
    }
  }, [dynasty, superflex, fmtKey, results])

  const shown = (entries ?? [])
    .filter((e) => pos === 'ALL' || e.position === pos)
    .slice(0, 200)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Toggle options={['Redraft', 'Dynasty']} value={dynasty ? 1 : 0} onChange={(i) => setDynasty(i === 1)} />
        <Toggle options={['1QB', 'SF']} value={superflex ? 1 : 0} onChange={(i) => setSuperflex(i === 1)} />
      </div>
      <div className="flex gap-1.5">
        {POSITIONS.map((p) => (
          <button
            key={p}
            onClick={() => setPos(p)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${pos === p ? 'bg-accent text-black' : 'bg-surface-2 text-gray-300'}`}
          >
            {p}
          </button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-loss/10 p-3 text-sm text-loss">{error}</p>}
      {!entries && !error && <p className="animate-pulse py-8 text-center text-gray-400">Loading values…</p>}
      {entries && (
        <ol className="flex flex-col gap-1">
          {shown.map((e) => (
            <li key={`${e.name}-${e.position}`} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
              <span className="w-7 text-right text-xs text-gray-500">{pos === 'ALL' ? e.overallRank : e.positionRank}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{e.name}</p>
                <p className="text-[11px] text-gray-500">
                  {e.position}
                  {e.team ? ` · ${e.team}` : ''}
                </p>
              </div>
              <span className={`text-xs tabular-nums ${e.trend30Day > 0 ? 'text-win' : e.trend30Day < 0 ? 'text-loss' : 'text-gray-500'}`}>
                {e.trend30Day > 0 ? '▲' : e.trend30Day < 0 ? '▼' : ''} {Math.abs(e.trend30Day)}
              </span>
              <span className="w-14 text-right text-sm font-semibold text-accent tabular-nums">{e.value.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="pb-2 text-center text-[11px] text-gray-600">Trade values by FantasyCalc · refreshed daily</p>
    </div>
  )
}

function Toggle({ options, value, onChange }: { options: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o, i) => (
        <button
          key={o}
          onClick={() => onChange(i)}
          className={`rounded-lg py-1.5 text-sm font-medium ${value === i ? 'bg-accent text-black' : 'text-gray-400'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
