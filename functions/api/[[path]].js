import {
  analyzeStock,
  fetchIndexChange,
  fetchQuotesByGainRange
} from '../lib/handlers.js'

const jsonCors = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
}

function corsFor(method) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': method
  }
  if (method.includes('POST')) {
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
  }
  return headers
}

export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const route = url.pathname.replace(/^\/api\/?/, '')

  if (request.method === 'OPTIONS') {
    const method =
      route === 'analyze' ? 'POST, OPTIONS' : 'GET, OPTIONS'
    return new Response(null, { status: 204, headers: corsFor(method) })
  }

  try {
    if (route === 'quotes' && request.method === 'GET') {
      const minGain = Number(url.searchParams.get('minGain') ?? 3)
      const maxGain = Number(url.searchParams.get('maxGain') ?? 5)
      const quotes = await fetchQuotesByGainRange(minGain, maxGain)
      return new Response(
        JSON.stringify({ ok: true, total: quotes.length, data: quotes, mode: 'gain-range' }),
        { headers: jsonCors }
      )
    }

    if (route === 'index-change' && request.method === 'GET') {
      const indexChange = await fetchIndexChange()
      return new Response(JSON.stringify({ ok: true, indexChange }), { headers: jsonCors })
    }

    if (route === 'analyze' && request.method === 'POST') {
      const body = await request.json()
      const stocks = Array.isArray(body.stocks) ? body.stocks.slice(0, 6) : []
      const criteria = body.criteria || {}
      const indexChange = Number(body.indexChange) || 0
      const normalized = {
        minGain: criteria.minGain ?? 3,
        maxGain: criteria.maxGain ?? 5,
        minVolRatio: criteria.minVolRatio ?? 1,
        minTurnover: criteria.minTurnover ?? 5,
        maxTurnover: criteria.maxTurnover ?? 10,
        minCap: criteria.minCap ?? 50,
        maxCap: criteria.maxCap ?? 200,
        stairDays: criteria.stairDays ?? 5,
        requireMA: criteria.requireMA !== false,
        requireVWAP: criteria.requireVWAP !== false,
        requireIndex: criteria.requireIndex !== false
      }
      const results = await Promise.all(
        stocks.map((stock) => analyzeStock(stock, normalized, indexChange))
      )
      return new Response(JSON.stringify({ ok: true, data: results }), { headers: jsonCors })
    }

    return new Response(JSON.stringify({ ok: false, error: 'Not found' }), {
      status: 404,
      headers: jsonCors
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: jsonCors
    })
  }
}
