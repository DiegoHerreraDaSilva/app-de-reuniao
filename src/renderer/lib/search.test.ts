import { describe, expect, it } from 'vitest'
import type { MeetingInfo } from './api'
import { matches, parseQuery } from './search'

const now = new Date(2026, 9, 27, 15, 0) // terça, 27/10/2026
const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime()
const mk = (title: string, platform: string, startedAt: number): MeetingInfo => ({ name: title, dir: title, hasAta: true, lines: 1, title, platform, startedAt })

const list = [
  mk('Renovação de licenças', 'Microsoft Teams', at(2026, 10, 26)), // ontem
  mk('Orçamento anual', 'Google Meet', at(2026, 10, 27)), // hoje
  mk('Migração do servidor', 'Zoom', at(2026, 10, 20)), // semana passada
  mk('Treinamento equipe', 'Manual', at(2026, 9, 15)), // setembro
  mk('Reunião antiga', '', at(2026, 8, 3))
]
const find = (s: string) => list.filter(m => matches(m, parseQuery(s, now))).map(m => m.title)

describe('pesquisa inteligente', () => {
  it('sem texto devolve tudo', () => expect(find('')).toHaveLength(5))
  it('plataforma', () => {
    expect(find('teams')).toEqual(['Renovação de licenças'])
    expect(find('google meet')).toEqual(['Orçamento anual'])
    expect(find('zoom')).toEqual(['Migração do servidor'])
  })
  it('datas relativas', () => {
    expect(find('hoje')).toEqual(['Orçamento anual'])
    expect(find('ontem')).toEqual(['Renovação de licenças'])
    expect(find('semana passada')).toEqual(['Migração do servidor'])
    expect(find('esta semana')).toEqual(['Renovação de licenças', 'Orçamento anual'])
  })
  it('datas absolutas, mês e dia da semana', () => {
    expect(find('26/10')).toEqual(['Renovação de licenças'])
    expect(find('2026-10-27')).toEqual(['Orçamento anual'])
    expect(find('setembro')).toEqual(['Treinamento equipe'])
    expect(find('segunda')).toEqual(['Renovação de licenças']) // segunda mais recente = 26/10
    expect(find('30/02')).toEqual(find('')) // data inválida não filtra nada
  })
  it('título, sem acento e com erro de digitação', () => {
    expect(find('orcamento')).toEqual(['Orçamento anual'])
    expect(find('licencas')).toEqual(['Renovação de licenças'])
    expect(find('servidr')).toEqual(['Migração do servidor'])
    expect(find('reunião')).toHaveLength(5) // "reunião" é palavra de enfeite
  })
  it('combina plataforma, data e título', () => {
    expect(find('teams ontem licenças')).toEqual(['Renovação de licenças'])
    expect(find('zoom ontem')).toEqual([])
  })
  it('explica como entendeu', () => {
    expect(parseQuery('teams ontem orçamento', now).chips.map(c => c.kind)).toEqual(['data', 'plataforma', 'titulo'])
  })
})
