import { analyzeStock } from '../functions/lib/handlers.js'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
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

    res.status(200).json({ ok: true, data: results })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
