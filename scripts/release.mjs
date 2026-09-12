#!/usr/bin/env node
// One-command release: build + sign + generate latest.json + publish via gh.
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { homedir } from 'node:os'
import { join } from 'node:path'

const REPO = 'inflammationP/wbs-gantt'
const TARGET = 'windows-x86_64'
const KEY_PATH = join(homedir(), '.tauri', 'wbs-gantt.key')

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function run(cmd) {
  console.log(`\n> ${cmd}\n`)
  execSync(cmd, { stdio: 'inherit' })
}

const confPath = 'src-tauri/tauri.conf.json'
const conf = JSON.parse(readFileSync(confPath, 'utf8'))
const oldVersion = conf.version

// 1. version + notes
// Strip a leading "v" if the user typed it (version must be pure semver).
const version = ((await ask(`Version [current ${oldVersion}]: `)) || oldVersion).replace(/^v/, '')
const notes = (await ask('Release notes (enter to skip): ')) || ''

if (version !== oldVersion) {
  conf.version = version
  writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n')
}

const tag = `v${version}`
const setupName = `${conf.productName}_${version}_x64-setup.exe`
const sigPath = `src-tauri/target/release/bundle/nsis/${setupName}.sig`
const exePath = `src-tauri/target/release/bundle/nsis/${setupName}`

// 2. build with signing
process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(KEY_PATH, 'utf8').replace(/[\r\n]+$/, '')
process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
run('npm run tauri build')

// 3. read signature and write the update manifest
const signature = readFileSync(sigPath, 'utf8').trim()
const url = `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(setupName)}`
writeFileSync(
  'latest.json',
  JSON.stringify(
    {
      version,
      notes,
      pub_date: new Date().toISOString(),
      platforms: { [TARGET]: { signature, url } },
    },
    null,
    2,
  ) + '\n',
)

// 4. publish via GitHub CLI
const notesFile = '.release-notes.md'
writeFileSync(notesFile, notes || 'No release notes.')
try {
  run(`gh release create ${tag} "${exePath}" "latest.json" --title "${tag}" --notes-file ${notesFile} --repo ${REPO}`)
  console.log(`\n✅ Release ${tag} published. Users will auto-update on next launch.\n`)
} catch (err) {
  console.log('\n⚠️  gh CLI 未安装或未登录，未能自动发布。')
  console.log(`请手动把下面两个文件上传到 GitHub Release（tag: ${tag}）：`)
  console.log(`  1. ${exePath}`)
  console.log('  2. latest.json')
  console.log('  或在安装并登录 gh 后重新运行本脚本。\n')
}

// 5. stamp the release date into the docs
// The CHANGELOG heading and FEATURES' version line carry a 待发布 placeholder that
// has to become the real date. Done here because it was forgotten two releases
// running. Editing a doc must never block a release, so every failure is reported
// and skipped rather than thrown.
{
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const stamped = []
  const missing = []

  for (const file of ['CHANGELOG.md', 'FEATURES.md']) {
    try {
      const lines = readFileSync(file, 'utf8').split('\n')
      // Only lines naming the version being released, so an unrelated 待发布
      // elsewhere in the file is left alone.
      if (!lines.some((line) => line.includes(`v${version}`))) {
        missing.push(file)
        continue
      }
      const next = lines
        .map((line) => (line.includes(`v${version}`) ? line.replace(/待发布/g, today) : line))
        .join('\n')
      if (next !== lines.join('\n')) {
        writeFileSync(file, next)
        stamped.push(file)
      }
    } catch (err) {
      console.log(`⚠️  ${file} 未能更新（${err.message}）——不影响发布。`)
    }
  }

  if (stamped.length) {
    console.log(`📝 已把 ${stamped.join('、')} 里 v${version} 的「待发布」写成 ${today}，记得连同本次改动一起提交。\n`)
  }
  if (missing.length) {
    console.log(`⚠️  ${missing.join('、')} 里没有任何提到 v${version} 的行。`)
    console.log(`   要么版本号填错了，要么这次的变更记录还没写——请手工核对。\n`)
  }
}
