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
const version = (await ask(`Version [current ${oldVersion}]: `)) || oldVersion
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
