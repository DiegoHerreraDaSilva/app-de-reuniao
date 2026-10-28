// Metadados de cada reunião, em meta.json na pasta dela.
export interface Meta {
  title: string
  platform: string // "Microsoft Teams", "Google Meet", "Manual"... vazio nas reuniões antigas
  startedAt: number // ms desde 1970
  titleSource: 'user' | 'auto' // 'user': o título foi digitado; a ata não o sobrescreve
}

// Pastas antigas, sem meta.json: "2026-10-26-13-57 Título", com a hora em UTC.
export function metaFromFolderName(name: string): Meta {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2}) ?(.*)$/.exec(name)
  return {
    title: m?.[6].trim() || 'Reunião',
    platform: '',
    startedAt: m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : 0,
    titleSource: 'auto'
  }
}
