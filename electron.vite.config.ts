import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  main: { build: { rollupOptions: { input: 'src/main/index.ts' } } },
  preload: { build: { rollupOptions: { input: 'src/preload/index.ts' } } },
  renderer: {
    root: 'src/renderer',
    plugins: [
      react(),
      tailwindcss(),
      {
        // O react-refresh injeta um script inline no dev; no build o CSP fica estrito.
        name: 'csp-dev-inline',
        transformIndexHtml: html => html.replace('__DEV_INLINE__', command === 'serve' ? " 'unsafe-inline'" : '')
      }
    ],
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } }
  }
}))
