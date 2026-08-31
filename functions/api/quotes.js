import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { fetchQuotesByGainRange } = require('../../lib/handlers.js')

const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const minGain = Number(url.searchParams.get('minGain') ?? 3)
  const maxGain = Number(url.searchParams.get('maxGain') ?? 5)
  try {
    const quotes = await fetchQuotesByGainRange(minGain, maxGain)
    return new Response(
      JSON.stringify({ ok: true, total: quotes.length, data: quotes, mode: 'gain-range' }),
      { headers: cors }
    )
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }
  })
}
