import { motion } from 'framer-motion'
import { MicOff, Radio } from 'lucide-react'
import { useEffect } from 'react'
import { IconBox } from './components'
import { agent } from './lib/api'

// Toque curto de duas notas, sintetizado (sem arquivo): sobe ao detectar, desce quando a reunião acaba.
function chime(rising: boolean) {
  const ctx = new AudioContext()
  const notes = rising ? [659.25, 880] : [880, 659.25] // E5, A5
  notes.forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.14
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  })
  setTimeout(() => ctx.close(), 1000)
}

// Aviso no canto da tela. Parâmetros vêm da URL: kind=start|end, app=<nome>, timeout=<segundos, 0 = não expira>.
export default function Toast() {
  const q = new URLSearchParams(location.search)
  const end = q.get('kind') === 'end'
  const app = q.get('app') || 'um app'
  const timeout = Number(q.get('timeout')) || 0
  useEffect(() => { chime(!end) }, [end])

  return (
    <div className="p-3">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
        role="alertdialog" aria-labelledby="toast-title" aria-describedby="toast-text"
        className="card p-4"
      >
        <div className="flex items-start gap-3">
          <IconBox icon={end ? MicOff : Radio} color={end ? 'var(--warn)' : 'var(--brand)'} />
          <div className="min-w-0 flex-1">
            <h1 id="toast-title" className="text-sm font-semibold tracking-tight">{end ? 'A reunião terminou?' : 'Reunião detectada'}</h1>
            <p id="toast-text" className="muted mt-0.5 text-sm">
              {end ? 'O microfone deixou de ser usado. Encerrar e gerar a ata?' : `${app} está usando o microfone. Gerar a ata desta reunião?`}
            </p>
            {!end && <p className="muted mt-1 text-xs">Avise os participantes que ela será transcrita.</p>}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            autoFocus onClick={() => agent.answer(true)}
            className="pill-accent flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5"
          >
            {end ? 'Encerrar e gerar ata' : 'Gerar ata'}
          </button>
          <button
            onClick={() => agent.answer(false)}
            className="flex-1 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
          >
            {end ? 'Continuar gravando' : 'Ignorar'}
          </button>
        </div>

        {timeout > 0 && (
          <div className="bar-track mt-3 h-1 overflow-hidden rounded-full" aria-hidden>
            <motion.div
              className="pill-accent h-full w-full origin-left rounded-full"
              initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: timeout, ease: 'linear' }}
            />
          </div>
        )}
      </motion.div>
    </div>
  )
}
