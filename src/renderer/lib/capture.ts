import { agent } from './api'

// Worklet inline: repassa cada bloco do canal 0 como Float32 para o thread principal.
const WORKLET = `registerProcessor('tap', class extends AudioWorkletProcessor {
  process(i) { if (i[0][0]) this.port.postMessage(i[0][0].slice()); return true }
})`

// Nível (RMS suavizado) de cada fonte, lido pela UI para os medidores.
export const levels = { mic: 0, pc: 0 }

let ctx: AudioContext | null = null
let streams: MediaStream[] = []

function tap(stream: MediaStream, source: 'mic' | 'pc') {
  const node = new AudioWorkletNode(ctx!, 'tap')
  node.port.onmessage = e => {
    const f = e.data as Float32Array
    let sum = 0
    for (const v of f) sum += v * v
    levels[source] = Math.max(Math.sqrt(sum / (f.length || 1)), levels[source] * 0.92)
    agent.pcm(source, f.buffer as ArrayBuffer)
  }
  ctx!.createMediaStreamSource(stream).connect(node)
}

export async function startCapture() {
  ctx = new AudioContext({ sampleRate: 16000 }) // o navegador reamostra para 16 kHz
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })))
  const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
  const pc = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  pc.getVideoTracks().forEach(t => t.stop())
  streams = [mic, pc]
  tap(mic, 'mic')
  tap(new MediaStream(pc.getAudioTracks()), 'pc')
}

export function stopCapture() {
  streams.forEach(s => s.getTracks().forEach(t => t.stop()))
  streams = []
  ctx?.close(); ctx = null
  levels.mic = 0; levels.pc = 0
}
