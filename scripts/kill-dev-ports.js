const { execSync } = require('node:child_process')

const ports = [5198, 5199]

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (pid && /^\d+$/.test(pid)) pids.add(pid)
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
        console.log(`[kill-dev-ports] freed port ${port} (pid ${pid})`)
      } catch {
        // ignore
      }
    }
  } catch {
    // port free
  }
}

ports.forEach(killPort)
