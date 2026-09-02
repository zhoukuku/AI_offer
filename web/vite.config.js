import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 前端开发服务器，将 /api 代理到后端 8787 端口
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})