export interface Line { t: number; speaker: string; text: string }
export interface MeetingInfo { name: string; dir: string; hasAta: boolean; lines: number; title: string; platform: string; startedAt: number }
export interface MeetingDetail { ata: string | null; lines: Line[] }
export type KeyName = 'groq' | 'openai' | 'anthropic'
export interface Status { text: string; kind: 'info' | 'ok' | 'error' }
export interface CaptureEvent { on: boolean; title?: string }

interface Channels { line: Line; status: Status; capture: CaptureEvent; mic: string[] }

interface Agent {
  start(title: string): void
  stop(): void
  answer(accepted: boolean): void
  pcm(source: 'mic' | 'pc', buf: ArrayBuffer): void
  meetings(): Promise<MeetingInfo[]>
  readMeeting(dir: string): Promise<MeetingDetail>
  openMeeting(dir: string): Promise<void>
  makeAta(dir: string): Promise<void>
  keys(): Promise<Record<KeyName, boolean>>
  saveKey(name: KeyName, value: string): Promise<void>
  on<K extends keyof Channels>(channel: K, cb: (v: Channels[K]) => void): () => void
}

export const agent = (window as unknown as { agent: Agent }).agent
