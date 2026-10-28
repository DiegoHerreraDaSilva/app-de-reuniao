import { History as HistoryIcon, Mic, Moon, Settings as SettingsIcon, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { agent, type Line, type Status } from './lib/api'
import { startCapture, stopCapture } from './lib/capture'
import { cn } from './lib/utils'
import { History } from './views/History'
import { Meeting } from './views/Meeting'
import { Settings } from './views/Settings'

type Tab = 'meeting' | 'history' | 'settings'
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'meeting', label: 'Reunião', icon: Mic },
  { id: 'history', label: 'Histórico', icon: HistoryIcon },
  { id: 'settings', label: 'Configurações', icon: SettingsIcon }
]

export default function App() {
  const [tab, setTab] = useState<Tab>('meeting')
  const [recording, setRecording] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [startedAt, setStartedAt] = useState(0)
  const [lines, setLines] = useState<Line[]>([])
  const [status, setStatus] = useState<Status | null>(null)
  const [micApps, setMicApps] = useState<string[]>([])
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  // Estado da reunião fica aqui para sobreviver à troca de aba.
  useEffect(() => {
    const offs = [
      agent.on('line', l => setLines(p => [...p, l])),
      agent.on('status', setStatus),
      agent.on('mic', setMicApps),
      agent.on('capture', e => {
        setRecording(e.on)
        if (e.on) {
          setLines([]); setMeetingTitle(e.title ?? 'Reunião'); setStartedAt(Date.now()); setTab('meeting')
          startCapture().catch(err => setStatus({ text: `Erro de captura: ${err.message}`, kind: 'error' }))
        } else stopCapture()
      })
    ]
    return () => offs.forEach(off => off())
  }, [])

  function toggleTheme() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    setDark(next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch { /* sem storage */ }
  }

  return (
    <div className="flex h-full flex-col">
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
          boxShadow: '0 12px 28px -26px rgba(0,0,0,.9), 0 1px 0 0 var(--accent-glow)'
        }}
      >
        <div className="mx-auto flex max-w-[1500px] items-center gap-6 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="pill-accent grid size-9 place-items-center rounded-lg"><Mic className="size-[18px]" aria-hidden /></span>
            <span className="text-sm font-semibold tracking-tight">Meeting Agent</span>
          </div>
          <nav className="flex gap-1" aria-label="Seções">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  tab === id ? 'pill-accent' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
                {id === 'meeting' && recording && <span className="size-2 animate-pulse rounded-full bg-[var(--bad)]" aria-label="Gravando" />}
              </button>
            ))}
          </nav>
          <button
            onClick={toggleTheme} aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="ml-auto rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            {dark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
          </button>
        </div>
      </header>

      <main className="mx-auto min-h-0 w-full max-w-[1500px] flex-1 overflow-y-auto px-5 py-5">
        {tab === 'meeting' && <Meeting recording={recording} meetingTitle={meetingTitle} startedAt={startedAt} lines={lines} status={status} micApps={micApps} />}
        {tab === 'history' && <History />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
