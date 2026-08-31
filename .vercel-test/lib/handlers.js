const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchQuotePage(page, pageSize = 100) {
  const url =
    `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=${pageSize}` +
    `&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23` +
    `&fields=f2,f3,f5,f6,f8,f11,f12,f13,f14,f21`
  const json = await fetchJson(url)
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
        volumeRatio: num(item.f11),
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

  while (page <= 80 && !done) {
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
    await new Promise((r) => setTimeout(r, 60))
  }
  return collected
}

async function fetchAllQuotes(onProgress) {
  const all = []
  let page = 1
  const pageSize = 100
  while (page <= 60) {
    if (onProgress) onProgress(page, all.length)
    const batch = await fetchQuotePage(page, pageSize)
    all.push(...batch)
    if (batch.length < pageSize) break
    page += 1
    await new Promise((r) => setTimeout(r, 60))
  }
  return all
}

async function fetchKLines(secId, limit = 60) {
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secId)}` +
    `&klt=101&fqt=1&lmt=${limit}&end=20500101&fields1=f1,f2,f3,f4,f5,f6` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61`
  const json = await fetchJson(url)
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
  const url =
    `https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=${encodeURIComponent(secId)}` +
    `&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57,f58&iscr=0&ndays=1`
  const json = await fetchJson(url)
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
  const url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.000001&fields=f3'
  const json = await fetchJson(url)
  return num(json?.data?.f3)
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

module.exports = {
  fetchAllQuotes,
  fetchQuotesByGainRange,
  fetchKLines,
  fetchTrends,
  fetchIndexChange,
  passesBasic,
  analyzeStock
}
