const EM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  Referer: 'https://quote.eastmoney.com/'
}

/** push2 在本地/国内更稳，push2delay 在 Cloudflare 上更稳 */
const PUSH2_HOSTS = ['push2.eastmoney.com', 'push2delay.eastmoney.com']
const PUSH2HIS_HOSTS = ['push2his.eastmoney.com', 'push2delay.eastmoney.com']

/** Cloudflare Workers 免费版单次请求 subrequest 上限约 50 */
const MAX_QUOTE_PAGES = 30
const FETCH_RETRIES = 3
const PAGE_DELAY_MS = 80

let pushHostPref = 0
let hisHostPref = 0

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function emFetchJson(hosts, pathQuery, hostPrefKey) {
  const start = hostPrefKey === 'his' ? hisHostPref : pushHostPref
  const order = [...hosts.slice(start), ...hosts.slice(0, start)]
  let lastErr = '东方财富接口无响应'

  for (const host of order) {
    const url = `https://${host}${pathQuery}`
    for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(url, { headers: EM_HEADERS })
        if (!res.ok) {
          lastErr = `HTTP ${res.status}`
          if (attempt < FETCH_RETRIES - 1) await sleep(150 * (attempt + 1))
          continue
        }
        const json = await res.json()
        const idx = hosts.indexOf(host)
        if (idx >= 0) {
          if (hostPrefKey === 'his') hisHostPref = idx
          else pushHostPref = idx
        }
        return json
      } catch (err) {
        lastErr = err.message || lastErr
        if (attempt < FETCH_RETRIES - 1) await sleep(200 * (attempt + 1))
      }
    }
  }
  throw new Error(lastErr)
}

async function fetchPush2(pathQuery) {
  return emFetchJson(PUSH2_HOSTS, pathQuery, 'push')
}

async function fetchPush2His(pathQuery) {
  return emFetchJson(PUSH2HIS_HOSTS, pathQuery, 'his')
}

async function fetchQuotePage(page, pageSize = 100) {
  const pathQuery =
    `/api/qt/clist/get?pn=${page}&pz=${pageSize}` +
    `&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23` +
    `&fields=f2,f3,f5,f6,f8,f10,f11,f12,f13,f14,f21`
  const json = await fetchPush2(pathQuery)
  const raw = json?.data?.diff
  const diff = Array.isArray(raw) ? raw : raw ? Object.values(raw) : []
  return diff
    .map((item) => {
      const code = item.f12
      const name = item.f14
      if (!code || !name) return null
      return {
        code,
        name,
        market: item.f13,
        price: num(item.f2),
        changePercent: num(item.f3),
        volumeRatio: num(item.f10),
        turnoverPercent: num(item.f8),
        circulatingCapYi: num(item.f21) / 1e8,
        secId: `${item.f13}.${code}`
      }
    })
    .filter(Boolean)
}

/** 按涨幅降序拉取，只收集 [minGain, maxGain] 区间，避免扫全市场 5500+ 只 */
async function fetchQuotesByGainRange(minGain = 3, maxGain = 5, onProgress) {
  const collected = []
  let page = 1
  const pageSize = 100
  let done = false

  while (page <= MAX_QUOTE_PAGES && !done) {
    if (onProgress) onProgress(page, collected.length)
    const batch = await fetchQuotePage(page, pageSize)
    if (!batch.length) break

    for (const q of batch) {
      if (q.changePercent > maxGain) continue
      if (q.changePercent < minGain) {
        done = true
        break
      }
      collected.push(q)
    }

    if (batch.length < pageSize) break
    page += 1
    if (PAGE_DELAY_MS > 0) await sleep(PAGE_DELAY_MS)
  }
  return collected
}

async function fetchAllQuotes(onProgress) {
  const all = []
  let page = 1
  const pageSize = 100
  while (page <= MAX_QUOTE_PAGES) {
    if (onProgress) onProgress(page, all.length)
    const batch = await fetchQuotePage(page, pageSize)
    all.push(...batch)
    if (batch.length < pageSize) break
    page += 1
    if (PAGE_DELAY_MS > 0) await sleep(PAGE_DELAY_MS)
  }
  return all
}

async function fetchKLines(secId, limit = 60) {
  const pathQuery =
    `/api/qt/stock/kline/get?secid=${encodeURIComponent(secId)}` +
    `&klt=101&fqt=1&lmt=${limit}&end=20500101&fields1=f1,f2,f3,f4,f5,f6` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61`
  const json = await fetchPush2His(pathQuery)
  const lines = json?.data?.klines || []
  return lines.map((line) => {
    const p = line.split(',')
    return {
      date: p[0],
      open: num(p[1]),
      close: num(p[2]),
      high: num(p[3]),
      low: num(p[4]),
      volume: num(p[5])
    }
  })
}

async function fetchTrends(secId) {
  const pathQuery =
    `/api/qt/stock/trends2/get?secid=${encodeURIComponent(secId)}` +
    `&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57,f58&iscr=0&ndays=1`
  const json = await fetchPush2(pathQuery)
  const trends = json?.data?.trends || []
  return trends.map((line) => {
    const p = line.split(',')
    return {
      time: p[0],
      price: num(p[1]),
      avgPrice: num(p[2]),
      volume: num(p[3])
    }
  })
}

async function fetchIndexChange() {
  for (const host of PUSH2_HOSTS) {
    try {
      const json = await emFetchJson([host], '/api/qt/stock/get?secid=1.000001&fields=f3', 'push')
      const v = num(json?.data?.f3)
      if (v !== 0) return v
    } catch {
      /* try next host */
    }
  }
  return 0
}

function num(v) {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function movingAverage(values, period) {
  const out = []
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += values[j]
    out.push(sum / period)
  }
  return out
}

function checkVolumeStaircase(bars, days) {
  if (bars.length < days) return false
  const recent = bars.slice(-days)
  const volumes = recent.map((b) => b.volume)
  let upSteps = 0
  for (let i = 1; i < volumes.length; i++) {
    if (volumes[i] >= volumes[i - 1] * 0.9) upSteps++
  }
  const avgFirst = (volumes[0] + volumes[1]) / 2
  const avgLast = (volumes.at(-1) + volumes.at(-2)) / 2
  return upSteps >= volumes.length - 2 && avgLast > avgFirst * 1.05
}

function checkBullishMA(bars) {
  if (bars.length < 20) return { ok: false, reason: 'K线数据不足' }
  const closes = bars.map((b) => b.close)
  const ma5 = movingAverage(closes, 5)
  const ma10 = movingAverage(closes, 10)
  const ma20 = movingAverage(closes, 20)
  const last = closes.at(-1)
  const m5 = ma5.at(-1)
  const m10 = ma10.at(-1)
  const m20 = ma20.at(-1)
  if (last < m5 || last < m10 || last < m20) return { ok: false, reason: '股价位于均线下方' }
  if (m5 > m10 && m10 > m20) return { ok: true, reason: '' }
  return { ok: false, reason: '均线未多头排列' }
}

function checkIntraday(points, stockChange, indexChange, opts) {
  const passed = []
  const failed = []
  if (points.length < 10) {
    failed.push('分时数据不足')
    return { passed, failed }
  }
  if (opts.requireVWAP) {
    const below = points.filter((p) => p.price < p.avgPrice * 0.998).length
    if (below / points.length <= 0.15) passed.push('分时多数在均价线上方')
    else failed.push('分时多次跌破均价线')
  }
  if (opts.requireIndex) {
    if (stockChange > indexChange) passed.push('跑赢上证指数')
    else failed.push('未跑赢大盘')
  }
  return { passed, failed }
}

function passesBasic(q, c) {
  return (
    q.changePercent >= c.minGain &&
    q.changePercent <= c.maxGain &&
    q.volumeRatio > c.minVolRatio &&
    q.turnoverPercent >= c.minTurnover &&
    q.turnoverPercent <= c.maxTurnover &&
    q.circulatingCapYi >= c.minCap &&
    q.circulatingCapYi <= c.maxCap
  )
}

async function analyzeStock(stock, criteria, indexChange) {
  const passed = [
    `涨幅 ${stock.changePercent.toFixed(2)}%`,
    `量比 ${stock.volumeRatio.toFixed(2)}`,
    `换手 ${stock.turnoverPercent.toFixed(2)}%`,
    `流通市值 ${stock.circulatingCapYi.toFixed(1)} 亿`
  ]
  const failed = []

  const bars = await fetchKLines(stock.secId, 60)
  if (checkVolumeStaircase(bars, criteria.stairDays)) passed.push('成交量台阶式放量')
  else failed.push('成交量未呈台阶式放量')

  if (criteria.requireMA) {
    const ma = checkBullishMA(bars)
    if (ma.ok) passed.push('均线多头排列')
    else failed.push(ma.reason)
  }

  if (criteria.requireVWAP || criteria.requireIndex) {
    try {
      const points = await fetchTrends(stock.secId)
      const intra = checkIntraday(points, stock.changePercent, indexChange, criteria)
      passed.push(...intra.passed)
      failed.push(...intra.failed)
    } catch {
      failed.push('分时数据获取失败')
    }
  }

  return {
    stock,
    passed,
    failed,
    qualified: failed.length === 0,
    score: passed.length * 10 - failed.length * 15
  }
}

export {
  fetchAllQuotes,
  fetchQuotesByGainRange,
  fetchKLines,
  fetchTrends,
  fetchIndexChange,
  passesBasic,
  analyzeStock
}
