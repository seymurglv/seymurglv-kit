import { defineConfig } from 'vite'
import { banuiCollection } from './showcase/vite-plugin.mjs'

export default defineConfig({
  root: '.',
  plugins: [banuiCollection({ root: import.meta.dirname, probes: process.env.BANUI_PROBES ?? 'probes' })],
  server: { host: '127.0.0.1', port: 5179, strictPort: true },
})
