import { net } from 'electron'

// Os dois provedores têm a mesma API de transcrição (formato OpenAI).
const PROVIDERS = {
  groq: { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3' },
  openai: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'gpt-4o-transcribe' }
}
export type Provider = keyof typeof PROVIDERS

// net.fetch (Chromium) usa os certificados e o proxy do Windows; o fetch do Node falha atrás de inspeção TLS corporativa.
export async function transcribe(wav: Buffer, provider: Provider, apiKey: string): Promise<string> {
  const { url, model } = PROVIDERS[provider]
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'a.wav')
  form.append('model', model)
  form.append('language', 'pt')
  const r = await net.fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form })
  if (!r.ok) throw new Error(`${provider} ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return ((await r.json()) as { text: string }).text.trim()
}
