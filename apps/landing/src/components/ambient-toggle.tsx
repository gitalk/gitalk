import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import {
  AmbientEngine,
  DEFAULT_VOLUME,
  SEASONS,
  VOLUME_STEP,
  clampVolume,
  isSeason,
  seasonForDate,
  type Season
} from '../ambient'
import { useI18n } from '../i18n'

const STORAGE_KEY = 'gitalk-landing-ambient'
const BUTTON_CLASS = 'ambient-toggle'

interface Preferences {
  /** The visitor's choice, not whether sound is audible right now. */
  enabled: boolean
  season: Season
  /** True once a season was picked by hand; otherwise the calendar decides. */
  manual: boolean
  volume: number
}

/**
 * The ambient-sound switch at the end of the nav.
 *
 * Sound is always off on load, because a page may not start an AudioContext
 * before a gesture. What the visitor *chose* is remembered: a stored "on"
 * re-arms the switch after a reload and the first real interaction starts the
 * texture. Muting persists as muted, which is the case the page can honour
 * without a gesture.
 *
 * A single icon is the whole control: click toggles sound, right-click or the
 * left/right arrows walk the seasons, the up/down arrows change the volume.
 * The current season is in the tooltip either way, so the icon still says
 * which texture it would play.
 */
export function AmbientToggle() {
  const { t } = useI18n()
  const [preferences, setPreferences] = useState<Preferences>(readPreferences)
  const preferencesRef = useRef(preferences)
  const engineRef = useRef<AmbientEngine | null>(null)

  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  const update = useCallback((patch: Partial<Preferences>) => {
    const next = { ...preferencesRef.current, ...patch }
    preferencesRef.current = next
    setPreferences(next)
    writePreferences(next)
  }, [])

  const start = useCallback(() => {
    const current = preferencesRef.current
    if (!current.enabled) return
    try {
      const engine = engineRef.current ?? new AmbientEngine(current.volume)
      engineRef.current = engine
      engine.setVolume(current.volume)
      engine.start(current.season)
    } catch {
      // No Web Audio (or the browser refused a context): stay visually off
      // rather than promising sound that will never play.
      update({ enabled: false })
    }
  }, [update])

  const stop = useCallback(() => {
    engineRef.current?.mute()
  }, [])

  const toggle = useCallback(() => {
    const enabled = !preferencesRef.current.enabled
    update({ enabled })
    if (enabled) start()
    else stop()
  }, [start, stop, update])

  const cycleSeason = useCallback(
    (direction: number) => {
      const current = preferencesRef.current
      const index = SEASONS.indexOf(current.season)
      const season = SEASONS[(index + direction + SEASONS.length) % SEASONS.length]
      if (!season) return
      update({ season, manual: true })
      // A playing texture is crossfaded by the engine; while the switch is
      // only re-armed, the remembered choice moves and the next gesture uses it.
      if (engineRef.current?.context) engineRef.current.switchSeason(season)
    },
    [update]
  )

  const changeVolume = useCallback(
    (delta: number) => {
      const current = preferencesRef.current.volume
      const volume = clampVolume(current + delta)
      if (volume === current) return
      update({ volume })
      engineRef.current?.setVolume(volume)
    },
    [update]
  )

  // Unmount must leave nothing running behind.
  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  // A stored "on" could not have started sound before a gesture. Arm once and
  // let the first interaction (anywhere but the switch itself) begin the fade.
  useEffect(() => {
    if (!preferencesRef.current.enabled) return

    const detach = () => {
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
    }
    const onGesture = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        // Only an activation key, not, say, Tab moving focus through the page.
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return
      } else {
        const target = event.target
        // Clicking the switch itself means "mute", not "start".
        if (target instanceof Element && target.closest(`.${BUTTON_CLASS}`)) return
      }
      detach()
      start()
    }

    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)
    return detach
  }, [start])

  const { enabled, season, manual, volume } = preferences
  const seasonName = t.ambient.seasons[season]
  const seasonLabel = manual ? seasonName : `${seasonName}${t.ambient.defaultTag}`
  const label = fill(t.ambient.aria, {
    season: seasonLabel,
    state: enabled ? t.ambient.stateOn : t.ambient.stateOff
  })
  const hint = fill(t.ambient.hint, { volume: String(Math.round(volume * 100)) })

  const onContextMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    cycleSeason(1)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      changeVolume(event.key === 'ArrowUp' ? VOLUME_STEP : -VOLUME_STEP)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      cycleSeason(event.key === 'ArrowRight' ? 1 : -1)
    }
  }

  return (
    <button
      type="button"
      className={`nav-ctl ${BUTTON_CLASS}${enabled ? ' is-on' : ''}`}
      aria-pressed={enabled}
      aria-label={label}
      title={`${label} · ${hint}`}
      data-season={season}
      data-state={enabled ? 'on' : 'off'}
      onClick={toggle}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      <span className="ambient-icon" aria-hidden="true">
        {enabled ? (
          <Volume2 size={15} strokeWidth={1.8} />
        ) : (
          <VolumeX size={15} strokeWidth={1.8} />
        )}
      </span>
    </button>
  )
}

function readPreferences(): Preferences {
  const today = seasonForDate(new Date())
  const fallback: Preferences = {
    enabled: false,
    season: today,
    manual: false,
    volume: DEFAULT_VOLUME
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const stored: unknown = JSON.parse(raw)
    if (!stored || typeof stored !== 'object') return fallback
    const value = stored as Partial<Preferences>
    const manual = value.manual === true && isSeason(value.season)

    return {
      enabled: value.enabled === true,
      // A season chosen by hand survives reloads; the automatic one keeps
      // following the calendar, so the page is still right tomorrow.
      season: manual && isSeason(value.season) ? value.season : today,
      manual,
      volume: typeof value.volume === 'number' ? clampVolume(value.volume) : DEFAULT_VOLUME
    }
  } catch {
    return fallback
  }
}

function writePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Private mode: the choice simply will not survive the reload.
  }
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}
