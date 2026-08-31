const { fetchIndexChange } = require('../lib/handlers')

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' })

  try {
    const change = await fetchIndexChange()
    res.status(200).json({ ok: true, indexChange: change })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
