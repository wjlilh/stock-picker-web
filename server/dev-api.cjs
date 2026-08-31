const http = require('node:http')
const quotes = require('../api/quotes')
const indexChange = require('../api/index-change')
const analyze = require('../api/analyze')

process.on('uncaughtException', (err) => {
  console.error('[dev-api] uncaughtException:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[dev-api] unhandledRejection:', err)
})

function mockRes(res) {
  const state = { statusCode: 200 }
  return {
    status(code) {
      state.statusCode = code
      return this
    },
    setHeader(k, v) {
      res.setHeader(k, v)
    },
    json(obj) {
      res.statusCode = state.statusCode
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(obj))
    },
    end() {
      res.statusCode = state.statusCode
      res.end()
    }
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', async () => {
    try {
      const r = mockRes(res)
      const fakeReq = {
        method: req.method,
        query: Object.fromEntries(url.searchParams),
        body: body || undefined
      }
      if (url.pathname === '/api/quotes') return await quotes(fakeReq, r)
      if (url.pathname === '/api/index-change') return await indexChange(fakeReq, r)
      if (url.pathname === '/api/analyze') return await analyze(fakeReq, r)
      res.statusCode = 404
      res.end('not found')
    } catch (err) {
      console.error('[dev-api] handler error:', err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: err.message || 'internal error' }))
      }
    }
  })
})

server.on('error', (err) => {
  console.error('[dev-api] server error:', err)
  process.exit(1)
})

server.listen(5198, '127.0.0.1', () => {
  console.log('[dev-api] http://127.0.0.1:5198')
})
