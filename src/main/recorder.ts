export type Source = 'mic' | 'pc'
export const RATE = 16000
const MIN = 5 * RATE, MAX = 30 * RATE, SIL = Math.floor(0.6 * RATE), THR = 0.01

// Acumula PCM por fonte e emite uma fatia quando acha silêncio após 5 s, ou aos 30 s.
export class Slicer {
  private buf: Float32Array[] = []
  private len = 0
  private quiet = 0
  private voiced = false
  // thr: RMS abaixo do qual o quadro é silêncio. O microfone tem ruído de fundo (0,01); o áudio do PC
  // é silêncio digital (0) entre falas, então um limite baixo não perde voz baixa dos outros participantes.
  constructor(private source: Source, private onSlice: (pcm: Float32Array, source: Source) => void, private thr = THR) {}

  push(frame: Float32Array) {
    let sum = 0
    for (const v of frame) sum += v * v
    const rms = Math.sqrt(sum / (frame.length || 1))
    this.quiet = rms < this.thr ? this.quiet + frame.length : 0
    if (rms >= this.thr) this.voiced = true
    this.buf.push(frame); this.len += frame.length
    if (this.len >= MAX || (this.len >= MIN && this.quiet >= SIL)) this.flush()
  }

  flush() {
    if (!this.len) return
    const out = new Float32Array(this.len)
    let o = 0
    for (const f of this.buf) { out.set(f, o); o += f.length }
    const voiced = this.voiced
    this.buf = []; this.len = 0; this.quiet = 0; this.voiced = false
    // Fatia só de silêncio não vai à API: custa dinheiro e o modelo alucina texto nela.
    if (voiced) this.onSlice(out, this.source)
  }
}

export function toWav(pcm: Float32Array): Buffer {
  const b = Buffer.alloc(44 + pcm.length * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length * 2, 4); b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
  b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(pcm.length * 2, 40)
  pcm.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2))
  return b
}
