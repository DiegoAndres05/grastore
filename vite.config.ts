import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'grastore-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = req.url?.split('?')[0]
          if (path !== '/api/book' && path !== '/api/users') {
            next()
            return
          }
          void server.ssrLoadModule('/src/server/http.ts').then((mod) => {
            const handler = path === '/api/book' ? mod.handleBook : mod.handleUsers
            return handler(req, res)
          }).catch(next)
        })
      },
    },
  ],
})
