import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const scripts = readdirSync(new URL('./', import.meta.url)).filter((name) => /^check-.*\.mjs$/.test(name)).sort()
const failed = []
for (const script of scripts) {
  const result = spawnSync(process.execPath, [`scripts/${script}`], { cwd: root, stdio: 'inherit' })
  if (result.error || result.status !== 0) {
    if (result.error) console.error(result.error.message)
    failed.push(script)
  }
}
if (failed.length) console.error(`Failed: ${failed.join(', ')}`)
else console.log(`${scripts.length} checks passed`)
process.exitCode = failed.length ? 1 : 0
