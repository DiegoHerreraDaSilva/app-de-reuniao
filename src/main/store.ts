import { app, safeStorage } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { metaFromFolderName, type Meta } from './meta'

export interface Line { t: number; speaker: string; text: string }
export interface MeetingInfo { name: string; dir: string; hasAta: boolean; lines: number; title: string; platform: string; startedAt: number }
export type KeyName = 'groq' | 'openai' | 'anthropic'
export const KEY_NAMES: KeyName[] = ['groq', 'openai', 'anthropic']

const root = () => join(app.getPath('documents'), 'MeetingAgent')

export function readMeta(dir: string): Meta {
  const f = join(dir, 'meta.json')
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Meta) : metaFromFolderName(basename(dir))
}
export const writeMeta = (dir: string, meta: Meta) => writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2))

export function newMeetingDir(title: string) {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}` // hora local
  const dir = join(root(), `${stamp} ${title.replace(/[^\p{L}\p{N}.\- ]/gu, '')}`.trim())
  mkdirSync(dir, { recursive: true })
  return dir
}

// O renderer só pode pedir pastas dentro de Documentos\MeetingAgent.
export function assertMeetingDir(dir: string) {
  if (!resolve(dir).startsWith(resolve(root()) + sep)) throw new Error('Pasta fora de MeetingAgent.')
  return dir
}

export function listMeetings(): MeetingInfo[] {
  if (!existsSync(root())) return []
  return readdirSync(root(), { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const dir = join(root(), d.name)
      const t = join(dir, 'transcript.jsonl')
      const { title, platform, startedAt } = readMeta(dir)
      return {
        name: d.name, dir, title, platform, startedAt,
        hasAta: existsSync(join(dir, 'ata.md')),
        lines: existsSync(t) ? readFileSync(t, 'utf8').split('\n').filter(Boolean).length : 0
      }
    })
    .sort((a, b) => b.startedAt - a.startedAt)
}

export interface MeetingDetail { ata: string | null; lines: Line[] }

export function readMeeting(dir: string): MeetingDetail {
  const ata = join(dir, 'ata.md')
  const t = join(dir, 'transcript.jsonl')
  return {
    ata: existsSync(ata) ? readFileSync(ata, 'utf8') : null,
    lines: existsSync(t) ? readFileSync(t, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s) as Line).sort((a, b) => a.t - b.t) : []
  }
}

export const appendLine =(dir: string, l: Line) => appendFileSync(join(dir, 'transcript.jsonl'), JSON.stringify(l) + '\n')

export function readTranscript(dir: string): string {
  const f = join(dir, 'transcript.jsonl')
  if (!existsSync(f)) return ''
  return readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(s => {
    const l = JSON.parse(s) as Line
    return `[${new Date(l.t * 1000).toISOString().slice(11, 19)}] ${l.speaker}: ${l.text}`
  }).join('\n')
}

// Chaves de API cifradas com DPAPI (safeStorage), em userData. "apikey.bin" é a da Anthropic (nome legado).
const keyFile = (n: KeyName) => join(app.getPath('userData'), n === 'anthropic' ? 'apikey.bin' : `${n}.bin`)
const ENV: Record<KeyName, string> = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', groq: 'GROQ_API_KEY' }
export const saveKey = (n: KeyName, k: string) => writeFileSync(keyFile(n), safeStorage.encryptString(k.trim()))
export const loadKey = (n: KeyName) => (existsSync(keyFile(n)) ? safeStorage.decryptString(readFileSync(keyFile(n))) : process.env[ENV[n]] ?? '')
