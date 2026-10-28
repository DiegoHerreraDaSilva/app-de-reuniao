import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'

export type ToastKind = 'start' | 'end'

// Aviso próprio no canto da tela (a mesma UI React, rota #toast). Resolve true se o usuário aceitou.
const pending = new Map<number, (accepted: boolean) => void>() // id do webContents -> resolvedor

ipcMain.on('toast:answer', (e, accepted: boolean) => pending.get(e.sender.id)?.(!!accepted))

// timeoutSec > 0: some sozinho como "ignorar". O aviso de fim não expira: ignorar ele deixaria a gravação rodando.
export function ask(kind: ToastKind, app = '', timeoutSec = 0): Promise<boolean> {
  return new Promise(resolve => {
    const { x, y, width, height } = screen.getPrimaryDisplay().workArea
    const w = 400, h = 230
    const t = new BrowserWindow({
      width: w, height: h, x: x + width - w, y: y + height - h,
      frame: false, transparent: true, hasShadow: false, resizable: false, minimizable: false, maximizable: false,
      skipTaskbar: true, alwaysOnTop: true, show: false,
      // autoplayPolicy: o toque toca ao abrir, sem clique do usuário.
      webPreferences: { preload: join(__dirname, '../preload/index.js'), autoplayPolicy: 'no-user-gesture-required' }
    })
    const id = t.webContents.id
    let timer: NodeJS.Timeout | undefined
    const finish = (accepted: boolean) => {
      if (!pending.delete(id)) return
      clearTimeout(timer)
      t.destroy()
      resolve(accepted)
    }
    pending.set(id, finish)
    t.on('closed', () => finish(false))
    if (timeoutSec > 0) timer = setTimeout(() => finish(false), timeoutSec * 1000)

    t.setAlwaysOnTop(true, 'screen-saver')
    t.once('ready-to-show', () => t.showInactive()) // não rouba o foco da chamada
    const query = { kind, app, timeout: String(timeoutSec) }
    if (process.env.ELECTRON_RENDERER_URL) {
      const u = new URL(process.env.ELECTRON_RENDERER_URL)
      Object.entries(query).forEach(([k, v]) => u.searchParams.set(k, v))
      u.hash = 'toast'
      t.loadURL(u.toString())
    } else t.loadFile(join(__dirname, '../renderer/index.html'), { query, hash: 'toast' })
  })
}
