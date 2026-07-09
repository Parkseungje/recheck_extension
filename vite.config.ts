import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  // CRXJS가 HMR용으로 쓰는 포트. 고정해두면 개발 중 안정적.
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
})
