import type { PlatformAdapter } from './adapters/types'
import { SleeperAdapter } from './adapters/sleeper'

// Platform registry — adding Yahoo/Fleaflicker/ESPN later means registering an
// adapter here, nothing else changes.
export interface PlatformConfig {
  id: string
  label: string
  handleLabel: string // what the user types to connect (username, email, ...)
  enabled: boolean
  create: () => PlatformAdapter
}

export const PLATFORMS: PlatformConfig[] = [
  {
    id: 'sleeper',
    label: 'Sleeper',
    handleLabel: 'Sleeper username',
    enabled: true,
    create: () => new SleeperAdapter(),
  },
  { id: 'yahoo', label: 'Yahoo', handleLabel: 'Yahoo account', enabled: false, create: () => { throw new Error('Yahoo adapter pending API approval') } },
  { id: 'fleaflicker', label: 'Fleaflicker', handleLabel: 'Fleaflicker email', enabled: false, create: () => { throw new Error('Fleaflicker adapter is Phase 2') } },
  { id: 'espn', label: 'ESPN', handleLabel: 'ESPN league ID', enabled: false, create: () => { throw new Error('ESPN adapter is Phase 2') } },
]
