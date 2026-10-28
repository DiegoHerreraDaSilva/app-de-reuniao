import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { Line, Status } from './lib/api'
import { cn, mmss } from './lib/utils'

// Ícone de cabeçalho de card: caixa de 36px com fundo e anel translúcidos.
export function IconBox({ icon: Icon, color = 'var(--brand)' }: { icon: LucideIcon; color?: string }) {
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-lg"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 28%, transparent)`
      }}
    >
      <Icon size={18} style={{ color }} aria-hidden />
    </span>
  )
}

const KIND = {
  info: { icon: Info, color: 'var(--brand)' },
  ok: { icon: CheckCircle2, color: 'var(--ok)' },
  error: { icon: AlertTriangle, color: 'var(--bad)' }
}

// Estado nunca só por cor: ícone + texto.
export function Banner({ status }: { status: Status }) {
  const { icon: Icon, color } = KIND[status.kind]
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      role={status.kind === 'error' ? 'alert' : 'status'}
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="break-words">{status.text}</span>
    </motion.div>
  )
}

export function LineRow({ line }: { line: Line }) {
  const me = line.speaker === 'Eu'
  return (
    <div className="flex gap-3 py-2">
      <span className="muted w-11 shrink-0 pt-0.5 text-xs tabular-nums">{mmss(line.t)}</span>
      <span
        className={cn('h-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', me ? 'pill-accent' : 'border')}
        style={me ? undefined : { background: 'var(--surface-2)' }}
      >
        {line.speaker}
      </span>
      <p className="text-sm leading-relaxed">{line.text}</p>
    </div>
  )
}

const inline = (s: string): ReactNode[] =>
  s.split(/(\*\*[^*]+\*\*)/).map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p))

// Markdown mínimo da ata: títulos (#), listas (-) e **negrito**. Sem HTML cru, então não há injeção.
export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (!list.length) return
    out.push(<ul key={out.length} className="list-disc space-y-1 pl-5">{list.map((x, i) => <li key={i}>{inline(x)}</li>)}</ul>)
    list = []
  }
  text.split(/\r?\n/).forEach(line => {
    const b = /^\s*[-*]\s+(.*)/.exec(line)
    if (b) { list.push(b[1]); return }
    flush()
    const h = /^(#{1,3})\s+(.*)/.exec(line)
    if (h) {
      const cls = h[1].length === 1 ? 'text-base font-semibold' : 'mt-3 text-sm font-semibold'
      out.push(<h3 key={out.length} className={cls} style={h[1].length === 2 ? { color: 'var(--brand)' } : undefined}>{inline(h[2])}</h3>)
    } else if (line.trim()) out.push(<p key={out.length}>{inline(line)}</p>)
  })
  flush()
  return <div className="space-y-2 text-sm leading-relaxed">{out}</div>
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="flex max-w-sm flex-col items-center gap-2">
        <Icon className="size-12" style={{ color: 'var(--text-muted)' }} aria-hidden />
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        <p className="muted text-sm">{children}</p>
      </div>
    </div>
  )
}
