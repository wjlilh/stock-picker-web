import { fetchQuotesByGainRange } from '../lib/handlers.js'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' })

  try {
    const minGain = Number(req.query.minGain ?? 3)
    const maxGain = Number(req.query.maxGain ?? 5)
    console.log(`[quotes] fetching gain ${minGain}~${maxGain}% ...`)
    const started = Date.now()
    const quotes = await fetchQuotesByGainRange(minGain, maxGain, (page, n) => {
      if (page % 5 === 0) console.log(`[quotes] page ${page}, collected ${n}`)
    })
    console.log(`[quotes] done ${quotes.length} stocks in ${Date.now() - started}ms`)
    res.status(200).json({ ok: true, total: quotes.length, data: quotes, mode: 'gain-range' })
  } catch (err) {
    console.error('[quotes] error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
}
