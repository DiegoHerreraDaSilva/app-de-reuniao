import { AlertTriangle, CheckCircle2, KeyRound, Loader2, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconBox } from '../components'
import { agent, type KeyName } from '../lib/api'

function KeyCard({ name, icon, title, hint, configured, onSaved }: {
  name: KeyName; icon: LucideIcon; title: string; hint: string; configured: boolean; onSaved: () => void
}) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    try { await agent.saveKey(name, value); setValue(''); onSaved() }
    catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  const color = configured ? 'var(--ok)' : 'var(--warn)'
  const Badge = configured ? CheckCircle2 : AlertTriangle
  return (
    <section className="card p-5">
      <div className="flex items-center gap-3">
        <IconBox icon={icon} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="muted text-xs">{hint}</p>
        </div>
        <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
          <Badge className="size-3" aria-hidden /> {configured ? 'Configurada' : 'Não configurada'}
        </span>
      </div>
      <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); if (value.trim()) save() }}>
        <label className="sr-only" htmlFor={`key-${name}`}>{title}</label>
        <input
          id={`key-${name}`} type="password" autoComplete="off" value={value} onChange={e => setValue(e.target.value)}
          placeholder={configured ? 'Colar uma nova chave para substituir' : 'Colar a chave'}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
        />
        <button
          type="submit" disabled={saving || !value.trim()}
          className="pill-accent flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar
        </button>
      </form>
      {error && <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'color-mix(in srgb, var(--bad) 14%, transparent)', color: 'var(--bad)' }} role="alert">{error}</p>}
    </section>
  )
}

export function Settings() {
  const [keys, setKeys] = useState<Record<KeyName, boolean>>({ groq: false, openai: false, anthropic: false })
  const load = () => agent.keys().then(setKeys)
  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col gap-4">
      <KeyCard name="groq" icon={KeyRound} title="Groq: transcrição" hint="Whisper large-v3, com plano grátis. Se estiver configurada, é usada no lugar da OpenAI." configured={keys.groq} onSaved={load} />
      <KeyCard name="openai" icon={KeyRound} title="OpenAI: transcrição" hint="Modelo gpt-4o-transcribe. Só é usada se não houver chave do Groq." configured={keys.openai} onSaved={load} />
      <KeyCard name="anthropic" icon={KeyRound} title="Anthropic: ata" hint="Claude escreve a ata a partir da transcrição." configured={keys.anthropic} onSaved={load} />
      <section className="card p-5">
        <div className="flex items-center gap-3">
          <IconBox icon={ShieldCheck} color="var(--warn)" />
          <h2 className="text-sm font-semibold tracking-tight">Privacidade</h2>
        </div>
        <p className="muted mt-3 text-sm leading-relaxed">
          O áudio é enviado ao Groq (ou à OpenAI) em trechos de até 30 segundos e o texto da transcrição, à Anthropic. As chaves ficam cifradas neste PC.
          Avise os participantes que a reunião está sendo transcrita.
        </p>
      </section>
    </div>
  )
}
