import Anthropic from '@anthropic-ai/sdk'
import { net } from 'electron'
import { splitTitle } from './title'

const PROMPT = `Você recebe a transcrição de uma reunião (linhas "[hh:mm:ss] Quem: texto"; "Eu" é o dono do app, "Participantes" são os demais, sem distinção entre eles).
Comece a resposta com uma linha "TITULO: " seguida de um título curto para a reunião, com no máximo 4 palavras, sem aspas e sem ponto final (ex.: "TITULO: Renovação de licenças"). Depois, uma linha em branco.
Em seguida escreva a ATA em português do Brasil, em Markdown, com as seções: # Ata, ## Resumo, ## Decisões, ## Action items (responsável e prazo quando citados), ## Pendências.
Não invente nada que não esteja na transcrição; se uma seção não tiver conteúdo, escreva "Nenhum.". A transcrição pode ter erros de reconhecimento de voz.`

export async function summarize(transcript: string, apiKey: string): Promise<{ title: string | null; ata: string }> {
  // net.fetch (Chromium) usa os certificados e o proxy do Windows; o fetch do Node falha atrás de inspeção TLS corporativa.
  const client = new Anthropic({ apiKey, fetch: net.fetch as unknown as typeof fetch })
  const r = await client.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 4096,
    system: PROMPT,
    messages: [{ role: 'user', content: transcript }]
  })
  return splitTitle(r.content.map(b => (b.type === 'text' ? b.text : '')).join(''))
}
