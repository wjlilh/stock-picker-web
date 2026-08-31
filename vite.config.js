import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  server: {
    host: '127.0.0.1',
    port: 5199,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5198',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
