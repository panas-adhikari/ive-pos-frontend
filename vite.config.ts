import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const envFile = fileURLToPath(new URL('../backend/.env', import.meta.url))
const composeFile = fileURLToPath(new URL('../docker-compose.yml', import.meta.url))
const portFile = new URL('../backend/.api-port', import.meta.url)

function apiTarget(): string {
  if (process.env.POS_API_TARGET) return process.env.POS_API_TARGET

  try {
    const endpoint = execFileSync('docker', [
      'compose', '--env-file', envFile, '-f', composeFile, 'port', 'api', '8000',
    ], { cwd: projectRoot, encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const port = endpoint.match(/:(\d+)$/)?.[1]
    if (port) return `http://127.0.0.1:${port}`
  } catch {
    // Docker may be unavailable when running the backend directly.
  }

  try {
    const port = readFileSync(portFile, 'utf8').trim()
    if (/^\d+$/.test(port)) return `http://127.0.0.1:${port}`
  } catch {
    // No backend launcher has run yet.
  }
  return 'http://127.0.0.1:8000'
}

function apiProxy(): Plugin {
  let target = ''
  let checkedAt = 0
  return {
    name: 'live-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        if (Date.now() - checkedAt > 1000) {
          target = apiTarget()
          checkedAt = Date.now()
        }
        const destination = new URL(`/api${req.url ?? ''}`, target)
        const upstream = http.request(destination, {
          method: req.method,
          headers: req.headers,
        }, (response) => {
          res.writeHead(response.statusCode ?? 502, response.headers)
          response.pipe(res)
        })
        upstream.on('error', (error) => {
          server.config.logger.error(`API proxy to ${target} failed: ${error.message}`)
          if (!res.headersSent) res.writeHead(502)
          res.end('Backend unavailable')
        })
        req.pipe(upstream)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiProxy()],
})
