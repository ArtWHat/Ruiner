import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// На GitHub Pages сайт живёт в /Ruiner/; локально — в корне.
const base = process.env.GITHUB_PAGES === '1' ? '/Ruiner/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
