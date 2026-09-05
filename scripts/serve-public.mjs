import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../dist/public')
const port = Number(process.env.PUBLIC_PREVIEW_PORT ?? 4174)
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

function safePath(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    // A malformed percent-escape (e.g. `GET /%`) makes decodeURIComponent throw.
    // Unhandled it would kill the process and take the whole Playwright run with
    // it; treat it as a path that cannot resolve so the 404 document is served.
    return null
  }
  const normalized = normalize(decoded.replaceAll('\\', '/')).replace(/^(\.\.(\/|\\|$))+/, '')
  return join(root, normalized)
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://public.local').pathname
  let candidate = safePath(pathname)
  if (candidate && existsSync(candidate) && statSync(candidate).isDirectory()) {
    candidate = join(candidate, 'index.html')
  }
  let status = 200
  if (!candidate || !existsSync(candidate) || !statSync(candidate).isFile()) {
    candidate = pathname.startsWith('/ar/') ? join(root, 'ar/404.html') : join(root, '404.html')
    status = 404
  }
  response.statusCode = status
  response.setHeader('Content-Type', types[extname(candidate)] ?? 'application/octet-stream')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  // frame-ancestors is inert in the document's <meta> CSP, so the host owes it as a
  // header. Mirrors dist/public/deployment.json responseHeaders.
  response.setHeader('Content-Security-Policy', "frame-ancestors 'none'")
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  createReadStream(candidate).pipe(response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Leaveo public artifact listening on http://127.0.0.1:${port}`)
})
