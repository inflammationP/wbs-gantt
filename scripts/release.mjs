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

// 3. the update manifest
// The download URL has to name the asset exactly as GitHub stored it, and GitHub
// rewrites asset filenames on upload (spaces become dots). So the caller passes
// in the name GitHub reported back — never the local file name.
function writeManifest(assetName) {
  const signature = readFileSync(sigPath, 'utf8').trim()
  const url = `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(assetName)}`
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
  return url
}

// 4. publish via GitHub CLI
// The release starts as a draft: releases/latest keeps serving the previous
// manifest until this one is complete. A live release whose latest.json is
// missing or points at a 404 silently stops updates for every user, and keeps
// doing it until somebody notices.
const notesFile = '.release-notes.md'
writeFileSync(notesFile, notes || 'No release notes.')

let draftOpen = false
try {
  run(`gh release create ${tag} "${exePath}" --draft --title "${tag}" --notes-file ${notesFile} --repo ${REPO}`)
  draftOpen = true

  // Ask GitHub what it actually named the asset instead of guessing.
  const assets = JSON.parse(
    execSync(`gh release view ${tag} --repo ${REPO} --json assets`, { encoding: 'utf8' }),
  ).assets
  const assetName = assets.map((a) => a.name).find((n) => n.endsWith('-setup.exe'))
  if (!assetName) {
    throw new Error(`Release 里没有安装包资源（实际有：${assets.map((a) => a.name).join(', ') || '无'}）`)
  }

  const url = writeManifest(assetName)
  console.log(`   manifest url → ${url}`)
  run(`gh release upload ${tag} latest.json --repo ${REPO}`)
  run(`gh release edit ${tag} --repo ${REPO} --draft=false`)
  console.log(`\n✅ Release ${tag} published. Users will auto-update on next launch.\n`)
} catch (err) {
  console.log(`\n⚠️  未能自动完成发布：${err.message}`)
  if (draftOpen) {
    console.log(`   已留下草稿 Release ${tag}。草稿不会被 releases/latest 看到，现有用户不受影响；`)
    console.log('   补完或删除后重试即可（gh release upload / gh release edit / gh release delete）。')
  }
  // Manual path: GitHub rewrites spaces in asset names to dots, so point the URL
  // at the name it will most likely end up with.
  writeManifest(setupName.replace(/ /g, '.'))
  console.log(`请手动把下面两个文件上传到 GitHub Release（tag: ${tag}）：`)
  console.log(`  1. ${exePath}`)
  console.log('  2. latest.json')
  console.log(`上传后打开 https://github.com/${REPO}/releases/latest/download/latest.json 核对 url 字段，`)
  console.log('确认它真能下到安装包（GitHub 会把文件名里的空格改成点）。')
  console.log('或在安装并登录 gh 后重新运行本脚本。\n')
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
