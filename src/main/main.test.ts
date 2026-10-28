import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { SCRIPT } from './micsessions'
import { friendlyName, parseActiveMicApps } from './detector'
import { RATE, Slicer } from './recorder'

describe('parseActiveMicApps', () => {
  it('retorna só apps com LastUsedTimeStop 0', () => {
    const out = [
      'HKEY_CURRENT_USER\\...\\microphone\\NonPackaged\\C:#Program Files#Zoom#bin#Zoom.exe',
      '    LastUsedTimeStart    REG_QWORD    0x1dc',
      '    LastUsedTimeStop    REG_QWORD    0x0',
      '',
      'HKEY_CURRENT_USER\\...\\microphone\\MSTeams_8wekyb3d8bbwe',
      '    LastUsedTimeStop    REG_QWORD    0x1dd',
      ''
    ].join('\r\n')
    expect(parseActiveMicApps(out)).toEqual(['Zoom.exe'])
  })
})

// Integração (só Windows): o PowerShell residente compila o C# e imprime a linha MIC: periodicamente.
describe.skipIf(process.platform !== 'win32')('sonda WASAPI', () => {
  it('compila e emite a lista de apps com microfone ativo', async () => {
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')], { windowsHide: true })
    let out = '', err = ''
    ps.stderr.on('data', d => (err += d))
    const line = await new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`sem saída em 25 s. stderr: ${err}`)), 25000)
      ps.stdout.on('data', d => { out += d; const m = /^MIC:.*$/m.exec(out); if (m) { clearTimeout(t); resolve(m[0]) } })
    }).finally(() => ps.kill())
    expect(line).toMatch(/^MIC:/)
    expect(err.replace('#< CLIXML', '').trim()).toBe('') // o PowerShell escreve esse cabeçalho com -EncodedCommand
  }, 30000)
})

describe('friendlyName', () => {
  it('dá nome legível a Teams, Zoom e navegadores', () => {
    expect(friendlyName('MSTeams_8wekyb3d8bbwe')).toBe('Microsoft Teams')
    expect(friendlyName('Zoom.exe')).toBe('Zoom')
    expect(friendlyName('chrome.exe')).toBe('Navegador (chrome)')
    expect(friendlyName('Foo.exe')).toBe('Foo')
  })
})

describe('Slicer', () => {
  it('corta no silêncio após 5 s e não antes', () => {
    const slices: number[] = []
    const s = new Slicer('mic', p => slices.push(p.length))
    const loud = new Float32Array(RATE).fill(0.5)
    const quiet = new Float32Array(RATE).fill(0)
    for (let i = 0; i < 4; i++) s.push(loud)
    s.push(quiet) // 5 s, silêncio de 1 s >= 0,6 s
    expect(slices).toEqual([5 * RATE])
  })
  it('corta aos 30 s sem silêncio', () => {
    const slices: number[] = []
    const s = new Slicer('pc', p => slices.push(p.length))
    for (let i = 0; i < 30; i++) s.push(new Float32Array(RATE).fill(0.5))
    expect(slices).toEqual([30 * RATE])
  })
  it('descarta fatia só de silêncio', () => {
    const slices: number[] = []
    const s = new Slicer('mic', p => slices.push(p.length))
    for (let i = 0; i < 30; i++) s.push(new Float32Array(RATE))
    s.flush()
    expect(slices).toEqual([])
  })
})
