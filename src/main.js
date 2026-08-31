import './style.css'

const STORAGE_KEY = 'stock-picker-criteria'

const defaultCriteria = () => ({
  minGain: 3,
  maxGain: 5,
  minVolRatio: 1,
  minTurnover: 5,
  maxTurnover: 10,
  minCap: 50,
  maxCap: 200,
  stairDays: 5,
  requireMA: true,
  requireVWAP: true,
  requireIndex: true
})

function loadCriteria() {
  try {
    return { ...defaultCriteria(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  } catch {
    return defaultCriteria()
  }
}

function saveCriteria(c) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
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

async function apiGet(path, timeoutMs = 120000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(path, { signal: ctrl.signal })
    const json = await res.json()
    if (!res.ok || !json.ok) throw new Error(json.error || `请求失败 ${res.status}`)
    return json
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('请求超时，请稍后重试')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function apiPost(path, body, timeoutMs = 90000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
    const json = await res.json()
    if (!res.ok || !json.ok) throw new Error(json.error || `请求失败 ${res.status}`)
    return json
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('分析请求超时')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function setStatus(text) {
  document.getElementById('status').textContent = text
}

function showProgress(pct) {
  const wrap = document.getElementById('progress-wrap')
  const bar = document.getElementById('progress-bar')
  wrap.classList.remove('hidden')
  bar.style.width = `${Math.min(100, Math.max(0, pct))}%`
}

function hideProgress() {
  document.getElementById('progress-wrap').classList.add('hidden')
  document.getElementById('progress-bar').style.width = '0%'
}

function renderResults(list) {
  const el = document.getElementById('results')
  if (!list.length) {
    el.innerHTML = '<p class="empty">今日暂无完全符合 7 条规则的股票</p>'
    return
  }
  el.innerHTML = list
    .map(
      (r) => `
    <article class="card" data-code="${r.stock.code}">
      <div class="card-head">
        <div>
          <div class="name">${r.stock.name}</div>
          <div class="code">${r.stock.code}</div>
        </div>
        <div class="gain">+${r.stock.changePercent.toFixed(2)}%</div>
      </div>
      <div class="meta">量比 ${r.stock.volumeRatio.toFixed(2)} · 换手 ${r.stock.turnoverPercent.toFixed(2)}%</div>
      <details>
        <summary>查看通过项 (${r.passed.length})</summary>
        <ul class="rules">${r.passed.map((x) => `<li class="ok">✓ ${x}</li>`).join('')}</ul>
      </details>
    </article>`
    )
    .join('')
}

function readFormCriteria() {
  return {
    minGain: Number(document.getElementById('minGain').value),
    maxGain: Number(document.getElementById('maxGain').value),
    minVolRatio: Number(document.getElementById('minVolRatio').value),
    minTurnover: Number(document.getElementById('minTurnover').value),
    maxTurnover: Number(document.getElementById('maxTurnover').value),
    minCap: Number(document.getElementById('minCap').value),
    maxCap: Number(document.getElementById('maxCap').value),
    stairDays: 5,
    requireMA: document.getElementById('requireMA').checked,
    requireVWAP: document.getElementById('requireVWAP').checked,
    requireIndex: document.getElementById('requireIndex').checked
  }
}

function fillForm(c) {
  document.getElementById('minGain').value = c.minGain
  document.getElementById('maxGain').value = c.maxGain
  document.getElementById('minVolRatio').value = c.minVolRatio
  document.getElementById('minTurnover').value = c.minTurnover
  document.getElementById('maxTurnover').value = c.maxTurnover
  document.getElementById('minCap').value = c.minCap
  document.getElementById('maxCap').value = c.maxCap
  document.getElementById('requireMA').checked = c.requireMA
  document.getElementById('requireVWAP').checked = c.requireVWAP
  document.getElementById('requireIndex').checked = c.requireIndex
}

let criteria = loadCriteria()
fillForm(criteria)

let running = false

async function runScreen() {
  if (running) return
  running = true
  const btn = document.getElementById('btn-screen')
  btn.disabled = true
  btn.textContent = '筛选中…'
  document.getElementById('results').innerHTML = ''
  hideProgress()

  const tick = { n: 0 }
  const timer = setInterval(() => {
    tick.n += 1
  }, 1000)

  try {
    setStatus('正在拉取涨幅 3~5% 区间行情（约 10~30 秒）…')
    showProgress(8)

    const qs = new URLSearchParams({
      minGain: String(criteria.minGain),
      maxGain: String(criteria.maxGain)
    })
    const { data: quotes } = await apiGet(`/api/quotes?${qs}`, 180000)
    showProgress(35)

    const candidates = quotes.filter((q) => passesBasic(q, criteria))
    setStatus(`涨幅区间 ${quotes.length} 只 → 规则1~4 通过 ${candidates.length} 只，深度分析中…`)

    if (!candidates.length) {
      renderResults([])
      setStatus(`完成：涨幅区间内无符合量比/换手/市值条件的股票（用时 ${tick.n}s）`)
      return
    }

    const { indexChange } = await apiGet('/api/index-change', 30000)
    const matched = []
    const batchSize = 4
    const total = candidates.length

    for (let i = 0; i < total; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize)
      const done = Math.min(i + batchSize, total)
      const pct = 35 + Math.round((done / total) * 60)
      showProgress(pct)
      setStatus(`深度分析 ${done}/${total}（已找到 ${matched.length} 只，${tick.n}s）…`)

      const { data } = await apiPost('/api/analyze', {
        stocks: batch,
        criteria,
        indexChange
      })
      const hit = data.filter((r) => r.qualified)
      matched.push(...hit)
      if (hit.length) renderResults(matched.sort((a, b) => b.score - a.score))
    }

    matched.sort((a, b) => b.score - a.score)
    renderResults(matched)
    showProgress(100)
    setStatus(`完成：扫描 ${quotes.length} 只，候选 ${total} 只，符合 ${matched.length} 只（${tick.n}s）`)
    localStorage.setItem('stock-picker-last-run', new Date().toISOString())
  } catch (err) {
    setStatus('筛选失败')
    const msg = err.message || '未知错误'
    const hint =
      msg.includes('502') || msg.includes('东方财富')
        ? '<p class="hint">云端访问东方财富可能受限，可改用电脑运行 <code>npm run dev:lan</code>，手机连同一 WiFi 访问。</p>'
        : ''
    document.getElementById('results').innerHTML = `<p class="error">${msg}</p>${hint}`
  } finally {
    clearInterval(timer)
    hideProgress()
    running = false
    btn.disabled = false
    btn.textContent = '开始筛选'
  }
}

document.getElementById('btn-screen').addEventListener('click', runScreen)

const dlg = document.getElementById('dlg-settings')
document.getElementById('btn-settings').addEventListener('click', () => dlg.showModal())
dlg.addEventListener('close', () => {
  if (dlg.returnValue === 'ok') {
    criteria = readFormCriteria()
    saveCriteria(criteria)
  } else {
    fillForm(criteria)
  }
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
