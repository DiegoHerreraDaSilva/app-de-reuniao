import type { MeetingInfo } from './api'

// Pesquisa inteligente do Histórico, local e sem custo: entende datas, plataformas e palavras do título
// escritas do jeito que se fala. Ex.: "teams ontem", "orçamento semana passada", "26/10", "zoom outubro".

export interface Chip { kind: 'data' | 'plataforma' | 'titulo'; label: string }
export interface Query {
  words: string[] // palavras do título (todas precisam casar)
  platforms: string[] // chaves normalizadas (qualquer uma serve)
  ranges: [number, number][] // [início, fim) em ms (qualquer uma serve)
  chips: Chip[] // como a pesquisa foi entendida, para mostrar na tela
}

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const DAY = 86400000
const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const PLATFORMS: Record<string, string> = {
  teams: 'teams', meet: 'meet', zoom: 'zoom', manual: 'manual',
  navegador: 'navegador', chrome: 'navegador', edge: 'navegador', msedge: 'navegador', firefox: 'navegador'
}
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'a', 'o', 'as', 'os', 'com', 'google', 'microsoft', 'reuniao', 'reunioes'])

const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime()

export function parseQuery(raw: string, now = new Date()): Query {
  let q = ` ${norm(raw)} `
  const ranges: [number, number][] = []
  const chips: Chip[] = []
  const platforms: string[] = []
  const today = day(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = (now.getDay() + 6) % 7 // segunda = 0
  const monday = today - dow * DAY
  const monthStart = day(now.getFullYear(), now.getMonth(), 1)

  // Cada padrão de data consome o trecho da pesquisa; fn devolve o intervalo, ou null se a data é inválida.
  const take = (re: RegExp, fn: (m: RegExpExecArray) => [number, number] | null) => {
    const g = new RegExp(re.source, 'g')
    const found: RegExpExecArray[] = []
    for (let m = g.exec(q); m; m = g.exec(q)) found.push(m)
    q = q.replace(g, ' ')
    for (const m of found) {
      const r = fn(m)
      if (r) { ranges.push(r); chips.push({ kind: 'data', label: m[0].trim() }) }
    }
  }
  const oneDay = (t: number): [number, number] => [t, t + DAY]
  const validDate = (y: number, m: number, d: number) => {
    const t = new Date(y, m, d)
    return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d ? oneDay(t.getTime()) : null
  }

  take(/\b(\d{4})-(\d{2})-(\d{2})\b/, m => validDate(+m[1], +m[2] - 1, +m[3]))
  take(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/, m => {
    const mo = +m[2] - 1
    let y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : now.getFullYear()
    if (!m[3] && day(y, mo, +m[1]) > today) y-- // sem ano e no futuro: é do ano passado
    return validDate(y, mo, +m[1])
  })
  take(/\bultimos? (\d{1,3}) dias\b/, m => [today - (+m[1] - 1) * DAY, today + DAY])
  take(/\bsemana passada\b/, () => [monday - 7 * DAY, monday])
  take(/\b(?:esta|essa|nesta|nessa) semana\b/, () => [monday, monday + 7 * DAY])
  take(/\bmes passado\b/, () => [day(now.getFullYear(), now.getMonth() - 1, 1), monthStart])
  take(/\b(?:este|esse|neste|nesse) mes\b/, () => [monthStart, day(now.getFullYear(), now.getMonth() + 1, 1)])
  take(/\banteontem\b/, () => oneDay(today - 2 * DAY))
  take(/\bontem\b/, () => oneDay(today - DAY))
  take(/\bhoje\b/, () => oneDay(today))
  take(new RegExp(`\\b(${MONTHS.join('|')})(?: de)?(?: (\\d{4}))?\\b`), m => {
    const mo = MONTHS.indexOf(m[1])
    const y = m[2] ? +m[2] : mo > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear() // o mês mais recente que já passou
    return [day(y, mo, 1), day(y, mo + 1, 1)]
  })
  take(new RegExp(`\\b(${WEEKDAYS.join('|')})(?:[- ]feira)?\\b`), m => oneDay(today - ((now.getDay() - WEEKDAYS.indexOf(m[1]) + 7) % 7) * DAY))

  const words: string[] = []
  for (const tok of q.split(/[\s,;]+/).filter(Boolean)) {
    if (PLATFORMS[tok]) {
      if (!platforms.includes(PLATFORMS[tok])) { platforms.push(PLATFORMS[tok]); chips.push({ kind: 'plataforma', label: tok }) }
    } else if (!STOP.has(tok)) { words.push(tok); chips.push({ kind: 'titulo', label: tok }) }
  }
  return { words, platforms, ranges, chips }
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

// Casa se o trecho está no título, ou se alguma palavra do título é parecida (tolera erro de digitação).
function wordMatches(title: string, w: string) {
  if (title.includes(w)) return true
  if (w.length < 4) return false
  return title.split(/[^a-z0-9]+/).some(t => t.length >= 4 && distance(t, w) <= (w.length >= 7 ? 2 : 1))
}

export function matches(m: MeetingInfo, q: Query) {
  const platform = norm(m.platform || 'desconhecida')
  if (q.platforms.length && !q.platforms.some(p => platform.includes(p))) return false
  if (q.ranges.length && !q.ranges.some(([a, b]) => m.startedAt >= a && m.startedAt < b)) return false
  const title = norm(m.title)
  return q.words.every(w => wordMatches(title, w))
}
