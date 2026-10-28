import { app, BrowserWindow, desktopCapturer, ipcMain, Menu, session, shell, Tray, nativeImage } from 'electron'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { platformOf, watchMeetings } from './detector'
import { Slicer, toWav, type Source } from './recorder'
import { transcribe, type Provider } from './transcribe'
import { ask } from './toast'
import { summarize } from './summarize'
import { mdToDocx } from './export'
import { appendLine, assertMeetingDir, KEY_NAMES, listMeetings, loadKey, newMeetingDir, readMeeting, readMeta, readTranscript, saveKey, writeMeta, type KeyName } from './store'

let win: BrowserWindow
let tray: Tray
let quitting = false
let current: { dir: string; slicers: Record<Source, Slicer> } | null = null
let queue: Promise<unknown> = Promise.resolve()
let stopWatch = () => {}
let mutedUntil = 0

const ui = (channel: string, v: unknown) => { if (win && !win.isDestroyed()) win.webContents.send(channel, v) }
const say = (text: string, kind: 'info' | 'ok' | 'error' = 'info') => ui('status', { text, kind })

// typed: o título veio do usuário; a ata do Claude não o troca.
function startMeeting(title: string, platform: string, typed = false) {
  if (current) return
  const provider: Provider = loadKey('groq') ? 'groq' : 'openai'
  const apiKey = loadKey(provider)
  if (!apiKey) { win.show(); return say('Defina a chave do Groq ou da OpenAI em Configurações para transcrever.', 'error') }
  const dir = newMeetingDir(title)
  const t0 = Date.now()
  writeMeta(dir, { title, platform, startedAt: t0, titleSource: typed ? 'user' : 'auto' })
  let n = 0
  // A fatia vai para disco (WAV) antes de ir à API; se a transcrição falhar, o áudio fica para nova tentativa.
  const onSlice = (pcm: Float32Array, source: Source) => {
    const file = join(dir, `audio-${n++}-${source}.wav`)
    const t = (Date.now() - t0) / 1000
    writeFileSync(file, toWav(pcm))
    queue = queue.then(async () => {
      try {
        const text = await transcribe(readFileSync(file), provider, apiKey)
        unlinkSync(file)
        if (!text || /^[[(].*[\])]$/.test(text)) return // "[Música]", "(risos)": marcadores de ruído
        const line = { t, speaker: source === 'mic' ? 'Eu' : 'Participantes', text }
        appendLine(dir, line)
        ui('line', line)
      } catch (e) { say(`Erro na transcrição: ${(e as Error).message}`, 'error') }
    })
  }
  current = { dir, slicers: { mic: new Slicer('mic', onSlice), pc: new Slicer('pc', onSlice, 0.002) } }
  ui('capture', { on: true, title })
  say(`Gravando: ${title}`)
}

async function makeAta(dir: string) {
  const transcript = readTranscript(dir)
  if (!transcript) throw new Error('Nenhuma fala transcrita.')
  const key = loadKey('anthropic')
  if (!key) throw new Error('Defina a chave da Anthropic em Configurações para gerar a ata.')
  const { title, ata } = await summarize(transcript, key)
  writeFileSync(join(dir, 'ata.md'), ata)
  writeFileSync(join(dir, 'ata.docx'), await mdToDocx(ata))
  const meta = readMeta(dir)
  if (title && meta.titleSource !== 'user') writeMeta(dir, { ...meta, title })
}

async function stopMeeting() {
  if (!current) return
  const { dir, slicers } = current
  current = null
  ui('capture', { on: false })
  slicers.mic.flush(); slicers.pc.flush()
  say('Transcrevendo o final...')
  await queue
  try {
    say('Gerando ata...')
    await makeAta(dir)
    say('Ata gerada. Veja em Histórico.', 'ok')
  } catch (e) {
    console.error('Erro ao gerar ata:', e)
    say((e as Error).message, 'error')
  }
}

app.whenReady().then(() => {
  // Loopback: áudio do sistema (WASAPI). O vídeo é exigido pela API, mas descartado no renderer.
  session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => {
    desktopCapturer.getSources({ types: ['screen'] }).then(s => cb({ video: s[0], audio: 'loopback' }))
  })

  // No instalado, icon.png vem por extraResources (package.json); em dev, de resources/.
  const icon = nativeImage.createFromPath(join(app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources'), 'icon.png'))

  win = new BrowserWindow({
    icon,
    width: 940, height: 680, minWidth: 720, minHeight: 520, show: false, autoHideMenuBar: true,
    backgroundColor: '#020617',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), backgroundThrottling: false }
  })
  win.removeMenu()
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide() } })
  win.once('ready-to-show', () => win.show())

  tray = new Tray(icon.resize({ width: 32, height: 32 }))
  tray.setToolTip('Meeting Agent')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir', click: () => win.show() },
    { label: 'Sair', click: () => { quitting = true; app.quit() } }
  ]))
  tray.on('click', () => win.show())

  stopWatch = watchMeetings(
    async name => {
      if (current) return
      const platform = await platformOf(name)
      if (await ask('start', platform, 60)) startMeeting(platform, platform)
    },
    async () => {
      if (!current) return
      mutedUntil = Date.now() + 2500 // o toque do aviso sai no loopback e a transcrição inventaria texto para ele
      if (await ask('end')) stopMeeting()
    },
    apps => ui('mic', apps)
  )

  ipcMain.on('start', (_e, title: string) => startMeeting(title.trim() || 'Reunião', 'Manual', !!title.trim()))
  ipcMain.on('stop', () => stopMeeting())
  // O IPC pode entregar ArrayBuffer ou Uint8Array/Buffer; copia os bytes para alinhar em 4.
  ipcMain.on('pcm', (_e, source: Source, data: ArrayBuffer | Uint8Array) => {
    if (Date.now() < mutedUntil) return
    const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data)
    current?.slicers[source].push(new Float32Array(bytes.slice().buffer))
  })

  ipcMain.handle('meetings:list', () => listMeetings())
  ipcMain.handle('meetings:read', (_e, dir: string) => readMeeting(assertMeetingDir(dir)))
  ipcMain.handle('meetings:open', (_e, dir: string) => shell.openPath(assertMeetingDir(dir)).then(() => undefined))
  ipcMain.handle('meetings:ata', async (_e, dir: string) => { await makeAta(assertMeetingDir(dir)) })
  ipcMain.handle('keys:status', () => Object.fromEntries(KEY_NAMES.map(n => [n, !!loadKey(n)])))
  ipcMain.handle('keys:save', (_e, name: KeyName, value: string) => {
    if (!KEY_NAMES.includes(name)) throw new Error('Chave desconhecida.')
    saveKey(name, value)
  })
})

app.on('before-quit', () => { quitting = true; stopWatch() })
app.on('window-all-closed', () => {})
