import { execFile, spawn } from 'node:child_process'
import { SCRIPT } from './micsessions'

const MIC_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone'

// Fallback para Windows mais antigo: apps com LastUsedTimeStop == 0 estão usando o microfone agora.
// No Windows 11 recente esse registro não atualiza em tempo real; a fonte principal é o WASAPI (micsessions.ts).
export function parseActiveMicApps(regOutput: string): string[] {
  const apps: string[] = []
  for (const block of regOutput.split(/\r?\n\r?\n/)) {
    if (!/LastUsedTimeStop\s+REG_QWORD\s+0x0\s*$/m.test(block)) continue
    const key = block.split(/\r?\n/).find(l => l.startsWith('HKEY_'))
    if (!key) continue
    apps.push(key.split('\\').pop()!.replace(/^.*#/, ''))
  }
  return apps
}

// O próprio app, ditado do Windows, o app do Claude e processos de sistema não são reunião.
const IGNORED = ['electron.exe', 'meeting-agent', 'meeting agent', 'svchost', 'rundll32', 'audiodg', 'microsoftwindows.client', 'claude']

const query = () =>
  new Promise<string>(res => execFile('reg', ['query', MIC_KEY, '/s'], { windowsHide: true, maxBuffer: 1 << 24 }, (_e, out) => res(out ?? '')))

export function friendlyName(app: string) {
  if (/teams/i.test(app)) return 'Microsoft Teams'
  if (/zoom/i.test(app)) return 'Zoom'
  if (/chrome|msedge|firefox|brave|opera/i.test(app)) return `Navegador (${app.replace(/\.exe$/i, '')})`
  return app.replace(/\.exe$/i, '')
}

// Num navegador, o título da janela principal revela a plataforma ("Meet - abc-defg-hij").
// Limite: só enxerga a aba ativa; se a reunião estiver em outra aba, fica "Navegador (chrome)".
export function platformFromTitles(titles: string, fallback: string) {
  if (/(^|\n)\s*Meet\s*[–-]|meet\.google\.com|Google Meet/i.test(titles)) return 'Google Meet'
  if (/zoom/i.test(titles)) return 'Zoom'
  if (/teams/i.test(titles)) return 'Microsoft Teams'
  return fallback
}

export function platformOf(name: string): Promise<string> {
  if (!name.startsWith('Navegador')) return Promise.resolve(name)
  const cmd = 'Get-Process chrome,msedge,firefox,brave,opera -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | ForEach-Object { $_.MainWindowTitle }'
  return new Promise(res =>
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true, timeout: 8000 }, (_e, out) => res(platformFromTitles(out ?? '', name)))
  )
}

// PowerShell residente (-EncodedCommand: nada em disco e sem mexer na política de execução).
function startProbe(onApps: (apps: string[]) => void) {
  const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')], { windowsHide: true })
  let buf = ''
  ps.stdout.on('data', (d: Buffer) => {
    buf += d.toString()
    const lines = buf.split(/\r?\n/)
    buf = lines.pop()!
    for (const l of lines) if (l.startsWith('MIC:')) onApps(l.slice(4).split(';').filter(Boolean))
  })
  ps.stderr.on('data', (d: Buffer) => { const s = d.toString().replace('#< CLIXML', '').trim(); if (s) console.error('[mic-probe]', s) })
  ps.on('error', e => console.error('[mic-probe]', e))
  return () => ps.kill()
}

// onChange recebe a lista de apps usando o microfone sempre que ela muda (para a UI mostrar o monitoramento).
export function watchMeetings(onStart: (app: string) => void, onEnd: () => void, onChange: (apps: string[]) => void = () => {}) {
  let wasapi: string[] = []
  const stopProbe = startProbe(a => { wasapi = a })
  let active: string | null = null
  let last = ''
  const timer = setInterval(async () => {
    const all = [...new Set([...wasapi, ...parseActiveMicApps(await query())])]
    const apps = all.filter(a => !IGNORED.some(o => a.toLowerCase().includes(o)))
    if (apps.join('|') !== last) { last = apps.join('|'); onChange(apps.map(friendlyName)) }
    if (apps.length && !active) { active = apps[0]; onStart(friendlyName(active)) }
    else if (!apps.length && active) { active = null; onEnd() }
  }, 3000)
  return () => { clearInterval(timer); stopProbe() }
}
