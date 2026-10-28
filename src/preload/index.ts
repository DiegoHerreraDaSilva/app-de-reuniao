import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel: string, ...a: unknown[]) => ipcRenderer.invoke(channel, ...a)

contextBridge.exposeInMainWorld('agent', {
  start: (title: string) => ipcRenderer.send('start', title),
  stop: () => ipcRenderer.send('stop'),
  answer: (accepted: boolean) => ipcRenderer.send('toast:answer', accepted),
  pcm: (source: 'mic' | 'pc', buf: ArrayBuffer) => ipcRenderer.send('pcm', source, buf),
  meetings: () => invoke('meetings:list'),
  readMeeting: (dir: string) => invoke('meetings:read', dir),
  openMeeting: (dir: string) => invoke('meetings:open', dir),
  makeAta: (dir: string) => invoke('meetings:ata', dir),
  keys: () => invoke('keys:status'),
  saveKey: (name: string, value: string) => invoke('keys:save', name, value),
  on: (channel: 'line' | 'status' | 'capture' | 'mic', cb: (v: unknown) => void) => {
    const h = (_e: unknown, v: unknown) => cb(v)
    ipcRenderer.on(channel, h)
    return () => ipcRenderer.removeListener(channel, h)
  }
})
