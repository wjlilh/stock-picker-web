import { analyzeStock } from '../../shared/handlers.js'

const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

export async function onRequestPost(context) {
  try {
    const body = await context.request.json()
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
    return new Response(JSON.stringify({ ok: true, data: results }), { headers: cors })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: cors
    })
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
