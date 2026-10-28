// Gera build/icon.png, build/icon.ico e resources/icon.png a partir de scripts/icon.svg.
// Uso: npx electron scripts/make-icon.cjs   (renderiza o SVG no Chromium do Electron; sem dependências extras)
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

// ICO com PNGs embutidos (aceito desde o Windows Vista).
function ico(pngs) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(pngs.length, 4)
  const dir = Buffer.alloc(16 * pngs.length)
  let offset = 6 + dir.length
  pngs.forEach(({ size, data }, i) => {
    dir.writeUInt8(size === 256 ? 0 : size, i * 16)
    dir.writeUInt8(size === 256 ? 0 : size, i * 16 + 1)
    dir.writeUInt16LE(1, i * 16 + 4) // planos
    dir.writeUInt16LE(32, i * 16 + 6) // bits por pixel
    dir.writeUInt32LE(data.length, i * 16 + 8)
    dir.writeUInt32LE(offset, i * 16 + 12)
    offset += data.length
  })
  return Buffer.concat([head, dir, ...pngs.map(p => p.data)])
}

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8')
  const html = `<body style="margin:0;background:transparent;overflow:hidden">${svg}</body>`
  const win = new BrowserWindow({ show: false, width: 512, height: 512, useContentSize: true, transparent: true, frame: false, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise(r => setTimeout(r, 500))
  const big = await win.webContents.capturePage()
  const at = size => big.resize({ width: size, height: size, quality: 'best' }).toPNG()

  fs.mkdirSync(path.join(root, 'build'), { recursive: true })
  fs.mkdirSync(path.join(root, 'resources'), { recursive: true })
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), at(512))
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), ico(ICO_SIZES.map(size => ({ size, data: at(size) }))))
  fs.writeFileSync(path.join(root, 'resources', 'icon.png'), at(256))
  console.log('ok', big.getSize())
  app.quit()
})
