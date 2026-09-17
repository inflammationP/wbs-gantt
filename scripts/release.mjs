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

/**
 * Read lines until a blank one — for text that needs more than a single line.
 *
 * `rl.question` deliberately stops at the first newline, which is why release
 * notes used to be one line: pressing Enter ended the input instead of starting
 * the next bullet, so notes could not be written as a list at all.
 *
 * Reading until a blank line is the familiar "type a block of text" gesture, and
 * pressing Enter straight away still means "no notes", because the block comes
 * back empty. Ctrl+D (Ctrl+Z then Enter on Windows) finishes early, which is the
 * same thing.
 */
function askLines(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    process.stdout.write(prompt)
    const lines = []
    rl.on('line', (line) => {
      if (line.trim() === '') {
        rl.close()
        return
      }
      lines.push(line)
    })
    // Also fires when stdin ends, which is the same as finishing.
    rl.on('close', () => resolve(lines.join('\n')))
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
// One line per bullet; a blank line ends the block. Markdown is fine — these go
// into both the GitHub release body and `latest.json`, and the updater renders
// the latter as markdown.
const notes = await askLines(
  'Release notes — one bullet per line, blank line to finish (Enter alone to skip):\n> ',
)

// The version belongs in the commit that writes the changelog section — bump it
// there and a release finds it already correct, writes nothing, and leaves the
// tree clean. Reaching this branch means it was bumped late, so this file is now
// dirty and needs a commit of its own. Said out loud rather than left to be
// discovered: a silent extra edit here is exactly what produced the follow-up
// "0.4.0" commits.
if (version !== oldVersion) {
  conf.version = version
  writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n')
  console.log(
    `\n📝 ${confPath} 的版本号写成了 ${version}。\n` +
      '   正常路径是写变更记录那一节时顺手改掉它，这次没赶上 —— 发布完需要为这一个文件补一次提交。\n',
  )
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

// 5. stamp the release date into the docs — a fallback, not the normal path
// Both the CHANGELOG heading and FEATURES' version line are meant to carry their
// real date already: a section is written once, finished, and released as it
// stands. This only fires for a 待发布 placeholder that survived — a section
// written days before the release, whose date nobody re-checked. That case is
// why it exists (it was forgotten by hand two releases running); in the ordinary
// one it changes nothing, and the tree stays clean. Editing a doc must never
// block a release, so every failure is reported and skipped rather than thrown.
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
