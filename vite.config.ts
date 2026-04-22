import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const accessToken = env.VITE_ACCESS_TOKEN || ''

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      allowedHosts: ['.trycloudflare.com', 'localhost'],
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (accessToken) {
                proxyReq.setHeader('X-Access-Token', accessToken)
              }
            })
          },
        },
        '/media': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        '/static': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
