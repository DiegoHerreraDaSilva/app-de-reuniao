import { AnimatePresence, motion } from 'framer-motion'
import { AudioLines, Mic, MonitorSpeaker, Play, Radio, ScrollText, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Banner, Empty, IconBox, LineRow } from '../components'
import { agent, type Line, type Status } from '../lib/api'
import { levels } from '../lib/capture'
import { cn, mmss, toneVars } from '../lib/utils'

interface Props {
  recording: boolean
  meetingTitle: string
  startedAt: number
  lines: Line[]
  status: Status | null
  micApps: string[]
}

function Meter({ icon: Icon, label, value }: { icon: typeof Mic; label: string; value: number }) {
  const pct = Math.min(1, value * 6) * 100 // fala típica fica em RMS 0,05 a 0,2
  return (
    <div className="flex flex-1 items-center gap-3">
      <Icon className="size-4 shrink-0" style={{ color: 'var(--accent-hi)' }} aria-hidden />
      <div className="flex-1">
        <div className="muted mb-1 text-xs">{label}</div>
        <div className="bar-track h-2 overflow-hidden rounded-full" role="meter" aria-label={`Nível: ${label}`} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="pill-accent h-full rounded-full" style={{ width: `${pct}%`, transition: 'width 80ms linear' }} />
        </div>
      </div>
    </div>
  )
}

export function Meeting({ recording, meetingTitle, startedAt, lines, status, micApps }: Props) {
  const [title, setTitle] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [lv, setLv] = useState({ mic: 0, pc: 0 })
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => {
      setElapsed((Date.now() - startedAt) / 1000)
      setLv({ ...levels })
    }, 100)
    return () => clearInterval(id)
  }, [recording, startedAt])

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }) }, [lines.length])

  return (
    <div className="flex h-full flex-col gap-4">
      <AnimatePresence>{status && <Banner key={status.text} status={status} />}</AnimatePresence>

      {recording ? (
        <section className="card p-5" style={toneVars('bad')} aria-label="Gravação em andamento">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--bad)' }}>
                <span className="size-2 animate-pulse rounded-full" style={{ background: 'var(--bad)' }} aria-hidden />
                Gravando
              </span>
              <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">{meetingTitle}</h1>
            </div>
            <span className="num-hero text-4xl font-semibold tabular-nums" aria-label="Tempo de gravação">{mmss(elapsed)}</span>
          </div>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Meter icon={Mic} label="Eu (microfone)" value={lv.mic} />
            <Meter icon={MonitorSpeaker} label="Participantes (áudio do PC)" value={lv.pc} />
            <button
              onClick={() => agent.stop()}
              className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--surface-2)]"
            >
              <Square className="size-4" aria-hidden /> Parar e gerar ata
            </button>
          </div>
        </section>
      ) : (
        <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center" aria-label="Iniciar reunião">
          <IconBox icon={Radio} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">Aguardando reunião</h1>
            <p className="muted text-sm">O app avisa quando outro programa usar o microfone. Também dá para iniciar na mão.</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: micApps.length ? 'var(--warn)' : 'var(--ok)' }} role="status">
              <span className={cn('size-2 rounded-full', micApps.length ? 'animate-pulse' : '')} style={{ background: 'currentColor' }} aria-hidden />
              {micApps.length ? `Microfone em uso por: ${micApps.join(', ')}` : 'Monitorando o microfone: nenhum app em uso'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="title">Título da reunião</label>
            <input
              id="title" value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agent.start(title)}
              placeholder="Título da reunião"
              className="w-52 rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            />
            <button
              onClick={() => agent.start(title)}
              className="pill-accent flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
            >
              <Play className="size-4" aria-hidden /> Iniciar
            </button>
          </div>
        </section>
      )}

      <section className="card flex min-h-0 flex-1 flex-col" aria-label="Transcrição">
        <header className="flex items-center gap-3 border-b px-5 py-3">
          <IconBox icon={ScrollText} />
          <h2 className="text-sm font-semibold tracking-tight">Transcrição ao vivo</h2>
          <span className="muted ml-auto text-xs tabular-nums">{lines.length} {lines.length === 1 ? 'fala' : 'falas'}</span>
        </header>
        <div ref={list} className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          {lines.length === 0 ? (
            <Empty icon={AudioLines} title="Nada transcrito ainda">
              As falas aparecem aqui a cada poucos segundos depois que a gravação começa.
            </Empty>
          ) : (
            lines.map((l, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                <LineRow line={l} />
              </motion.div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
