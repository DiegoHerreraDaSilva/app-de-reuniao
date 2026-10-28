import { describe, expect, it } from 'vitest'
import { platformFromTitles } from './detector'
import { metaFromFolderName } from './meta'
import { splitTitle } from './title'

describe('splitTitle', () => {
  it('separa título e ata', () => {
    expect(splitTitle('TITULO: Renovação de licenças\n\n# Ata\n- x')).toEqual({ title: 'Renovação de licenças', ata: '# Ata\n- x' })
  })
  it('limita a 4 palavras e limpa enfeites', () => {
    expect(splitTitle('TÍTULO: **"Planejamento do orçamento de TI de 2027."**\n\n# Ata').title).toBe('Planejamento do orçamento')
  })
  it('não deixa o título terminar no meio da frase', () => {
    expect(splitTitle('TITULO: Demonstração de transcrição ao vivo\n\n# Ata').title).toBe('Demonstração de transcrição')
  })
  it('sem a linha de título devolve só a ata', () => {
    expect(splitTitle('# Ata\ntexto')).toEqual({ title: null, ata: '# Ata\ntexto' })
  })
})

describe('metaFromFolderName', () => {
  it('lê data (UTC) e título de pasta antiga', () => {
    const m = metaFromFolderName('2026-10-26-13-57 Reunião semanal')
    expect(m.title).toBe('Reunião semanal')
    expect(m.startedAt).toBe(Date.UTC(2026, 9, 26, 13, 57))
    expect(m.platform).toBe('')
  })
})

describe('platformFromTitles', () => {
  it('identifica a plataforma pelo título da janela do navegador', () => {
    expect(platformFromTitles('Meet - abc-defg-hij - Google Chrome', 'Navegador (chrome)')).toBe('Google Meet')
    expect(platformFromTitles('Zoom Meeting', 'x')).toBe('Zoom')
    expect(platformFromTitles('Meet the team - Notion', 'Navegador (chrome)')).toBe('Navegador (chrome)')
  })
})
