const DANGLING = new Set(['de', 'do', 'da', 'dos', 'das', 'ao', 'aos', 'a', 'o', 'as', 'os', 'e', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'sem', 'um', 'uma'])

// A resposta do Claude começa com "TITULO: <até 4 palavras>"; o resto é a ata.
export function splitTitle(text: string): { title: string | null; ata: string } {
  const m = /^\s*T[IÍ]TULO:\s*(.+?)\s*(?:\r?\n|$)/i.exec(text)
  if (!m) return { title: null, ata: text.trim() }
  // O limite de 4 palavras é garantido aqui; o modelo pode errar a contagem.
  const words = m[1].replace(/[*#"'`“”.]/g, '').trim().split(/\s+/).slice(0, 4)
  while (words.length > 1 && DANGLING.has(words[words.length - 1].toLowerCase())) words.pop() // não termina em "de", "ao"...
  return { title: words.join(' ') || null, ata: text.slice(m[0].length).trim() }
}
