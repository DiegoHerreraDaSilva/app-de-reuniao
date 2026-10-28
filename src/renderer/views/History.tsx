import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Copy, FileText, FolderOpen, History as HistoryIcon, Loader2, RefreshCw, Search, SearchX, Video } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Empty, IconBox, LineRow, Markdown } from '../components'
import { agent, type MeetingDetail, type MeetingInfo } from '../lib/api'
import { matches, parseQuery } from '../lib/search'
import { cn } from '../lib/utils'

const when = (t: number) => new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const CHIP_LABEL = { data: 'Data', plataforma: 'Plataforma', titulo: 'Título' }

type DetailTab = 'ata' | 'transcricao'

function Detail({ m }: { m: MeetingInfo }) {
  const [data, setData] = useState<MeetingDetail | null>(null)
  const [tab, setTab] = useState<DetailTab>('ata')
  const [copied, setCopied] = useState(false)

  // Relê quando a ata é gerada ou refeita (hasAta/lines mudam).
  useEffect(() => {
    agent.readMeeting(m.dir).then(d => { setData(d); if (!d.ata) setTab('transcricao') })
  }, [m.dir, m.hasAta, m.lines])

  async function copy() {
    if (!data?.ata) return
    try { await navigator.clipboard.writeText(data.ata); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch { /* sem permissão de área de transferência */ }
  }

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'ata', label: 'Ata' },
    { id: 'transcricao', label: `Transcrição (${data?.lines.length ?? m.lines})` }
  ]

  return (
    <div className="mt-4 border-t pt-4">
      <div className="mb-3 flex items-center gap-2" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', tab === t.id ? 'pill-accent' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]')}
          >
            {t.label}
          </button>
        ))}
        {tab === 'ata' && data?.ata && (
          <button onClick={copy} className="ml-auto flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-[var(--surface-2)]">
            {copied ? <Check className="size-4" style={{ color: 'var(--ok)' }} aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? 'Copiada' : 'Copiar ata'}
          </button>
        )}
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-lg px-4 py-3" style={{ background: 'var(--surface-2)' }} role="tabpanel">
        {!data ? (
          <Loader2 className="size-4 animate-spin" aria-label="Carregando" />
        ) : tab === 'ata' ? (
          data.ata ? <Markdown text={data.ata} /> : <p className="muted text-sm">Esta reunião ainda não tem ata. Use "Gerar ata".</p>
        ) : data.lines.length ? (
          data.lines.map((l, i) => <LineRow key={i} line={l} />)
        ) : (
          <p className="muted text-sm">Nenhuma fala transcrita nesta reunião.</p>
        )}
      </div>
    </div>
  )
}

export function History() {
  const [items, setItems] = useState<MeetingInfo[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ dir: string; msg: string } | null>(null)
  const [search, setSearch] = useState('')
  const query = useMemo(() => parseQuery(search), [search])
  const shown = useMemo(() => (items ?? []).filter(m => matches(m, query)), [items, query])

  const load = useCallback(() => agent.meetings().then(setItems), [])
  useEffect(() => { load() }, [load])

  async function ata(m: MeetingInfo) {
    setBusy(m.dir); setError(null)
    try { await agent.makeAta(m.dir); await load(); setOpen(m.dir) }
    catch (e) { setError({ dir: m.dir, msg: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') }) }
    finally { setBusy(null) }
  }

  if (!items) return <Empty icon={Loader2} title="Carregando..." />
  if (!items.length) return <Empty icon={HistoryIcon} title="Nenhuma reunião ainda">As reuniões gravadas aparecem aqui, com a transcrição e a ata.</Empty>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-hidden />
          <label className="sr-only" htmlFor="search">Pesquisar reuniões</label>
          <input
            id="search" type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por título, data ou plataforma: teams ontem, orçamento, 26/10, semana passada"
            className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          />
        </div>
        {search.trim() && (
          <div className="mt-2 flex flex-wrap items-center gap-2" aria-live="polite">
            {query.chips.map((c, i) => (
              <span key={i} className="pill-accent rounded-full px-2.5 py-0.5 text-xs font-medium">{CHIP_LABEL[c.kind]}: {c.label}</span>
            ))}
            <span className="muted ml-auto text-xs tabular-nums">{shown.length} de {items.length}</span>
          </div>
        )}
      </div>
      {!shown.length && <Empty icon={SearchX} title="Nenhuma reunião encontrada">Tente outras palavras, ou só a plataforma ou a data.</Empty>}
    <ul className="flex flex-col gap-4">
      {shown.map(m => {
        const title = m.title
        const working = busy === m.dir
        const expanded = open === m.dir
        return (
          <li key={m.dir} className="card p-5">
            <div className="flex flex-wrap items-center gap-4">
              <IconBox icon={FileText} color={m.hasAta ? 'var(--ok)' : 'var(--brand)'} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
                <p className="muted flex flex-wrap items-center gap-x-2 text-xs tabular-nums">
                  <span className="flex items-center gap-1"><Video className="size-3" aria-hidden />{m.platform || 'Plataforma desconhecida'}</span>
                  <span aria-hidden>·</span>
                  <span>{when(m.startedAt)}</span>
                  <span aria-hidden>·</span>
                  <span>{m.lines} {m.lines === 1 ? 'fala' : 'falas'}</span>
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  background: `color-mix(in srgb, ${m.hasAta ? 'var(--ok)' : 'var(--text-muted)'} 16%, transparent)`,
                  color: m.hasAta ? 'var(--ok)' : 'var(--text-muted)'
                }}
              >
                {m.hasAta ? 'Ata pronta' : 'Sem ata'}
              </span>
              <button
                onClick={() => setOpen(expanded ? null : m.dir)} aria-expanded={expanded}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
              >
                <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
                {expanded ? 'Fechar' : 'Ver'}
              </button>
              <button
                onClick={() => agent.openMeeting(m.dir)}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
              >
                <FolderOpen className="size-4" aria-hidden /> Abrir pasta
              </button>
              <button
                onClick={() => ata(m)} disabled={working || !m.lines}
                className="pill-accent flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {working ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                {working ? 'Gerando...' : m.hasAta ? 'Refazer ata' : 'Gerar ata'}
              </button>
            </div>
            {error?.dir === m.dir && (
              <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'color-mix(in srgb, var(--bad) 14%, transparent)', color: 'var(--bad)' }} role="alert">
                {error.msg}
              </p>
            )}
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <Detail m={m} />
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        )
      })}
    </ul>
    </div>
  )
}
