const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname)
const TARGET_DIRS = [
  path.join(ROOT, 'Arcadia2', 'frontend', 'src'),
  path.join(ROOT, 'Arcadia2', 'backend')
]

const exts = ['', '.js', '.jsx', '.ts', '.tsx', '.json']

function walk(dir) {
  const results = []
  const list = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of list) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue
      results.push(...walk(p))
    } else if (/\.(js|jsx|ts|tsx)$/.test(ent.name)) {
      results.push(p)
    }
  }
  return results
}

function findFileCandidates(resolved) {
  const cand = []
  for (const e of exts) {
    cand.push(resolved + e)
  }
  // if resolved points to a dir, check index files
  for (const e of ['.js', '.jsx', '.ts', '.tsx', '.json']) {
    cand.push(path.join(resolved, 'index' + e))
  }
  return cand
}

function checkFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const importRe = /import\s+[\s\S]*?from\s+['"]([^'\"]+)['"]/g
  const requireRe = /require\(\s*['"]([^'\"]+)['"]\s*\)/g

  const missing = []

  for (const re of [importRe, requireRe]) {
    let m
    while ((m = re.exec(src)) !== null) {
      const spec = m[1]
      if (spec.startsWith('.') || spec.startsWith('..')) {
        const resolved = path.resolve(path.dirname(file), spec)
        const candidates = findFileCandidates(resolved)
        const exists = candidates.some(c => fs.existsSync(c))
        if (!exists) missing.push({ spec, resolved, candidates })
      }
    }
  }

  return missing
}

const report = { files: [] }

for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) continue
  const files = walk(dir)
  for (const f of files) {
    const missing = checkFile(f)
    if (missing.length) report.files.push({ file: path.relative(ROOT, f), missing })
  }
}

const outPath = path.join(ROOT, 'check-imports-report.json')
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')

console.log('Scan complete. Missing import report written to:', outPath)
console.log('Files with missing imports:', report.files.length)
if (report.files.length) {
  for (const entry of report.files) {
    console.log('- ' + entry.file)
    for (const m of entry.missing) {
      console.log('   ->', m.spec)
    }
  }
}

process.exit(report.files.length ? 2 : 0)
