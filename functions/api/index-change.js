import { fetchIndexChange } from '../../shared/handlers.js'

const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

export async function onRequestGet() {
  try {
    const indexChange = await fetchIndexChange()
    return new Response(JSON.stringify({ ok: true, indexChange }), { headers: cors })
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
