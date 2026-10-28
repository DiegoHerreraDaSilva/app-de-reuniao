// A resposta do Claude começa com "TITULO: <até 4 palavras>"; o resto é a ata.
export function splitTitle(text: string): { title: string | null; ata: string } {
  const m = /^\s*T[IÍ]TULO:\s*(.+?)\s*(?:\r?\n|$)/i.exec(text)
  if (!m) return { title: null, ata: text.trim() }
  // O limite de 4 palavras é garantido aqui; o modelo pode errar a contagem.
  const title = m[1].replace(/[*#"'`“”.]/g, '').trim().split(/\s+/).slice(0, 4).join(' ')
  return { title: title || null, ata: text.slice(m[0].length).trim() }
}
