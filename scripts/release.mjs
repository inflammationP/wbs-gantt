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

/**
 * The typed block as a markdown list — one line, one bullet.
 *
 * The dash is added here rather than typed, because markdown joins consecutive
 * lines into a single paragraph: three separate points typed as three lines were
 * published as one wall of text (which is what the v0.6.1 notes did). A line
 * that already starts with a dash keeps one dash rather than gaining a second.
 *
 * These notes go to two places — the GitHub release body and `latest.json`,
 * which the updater renders as markdown — so the list has to survive both.
 */
function asList(block) {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line.replace(/^[-*]\s*/, '')}`)
    .join('\n')
}

function run(cmd) {
  console.log(`\n> ${cmd}\n`)
  execSync(cmd, { stdio: 'inherit' })
}

const confPath = 'src-tauri/tauri.conf.json'
const conf = JSON.parse(readFileSync(confPath, 'utf8'))

// 1. version + notes
//
// The version is read, never asked for. It was decided when the changelog
// section was written, and that same step writes it into `tauri.conf.json` — so
// that file is where it is kept, and asking for it again made the two able to
// disagree (a release tagged v0.4.1 against a section headed v0.5.0 is what that
// cost). Releasing a number that is not in there means editing the file first,
// which is the same commit the changelog section belongs in.
const version = conf.version
console.log(`\n版本号 v${version}（取自 ${confPath}）`)

// One line per point; a blank line ends the block and the dashes are added by
// `asList`. Markdown inside a line is fine and passes through.
const notes = asList(
  await askLines('\nRelease notes — one line per point, blank line to finish (Enter alone to skip):\n> '),
)

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

// 5. stamp the release date into the changelog — a fallback, not the normal path
// The heading is meant to carry its real date already: a section is written
// once, finished, and released as it stands. This only fires for a 待发布
// placeholder that survived — a section written days before the release, whose
// date nobody re-checked. That case is why it exists (it was forgotten by hand
// two releases running); in the ordinary one it changes nothing, and the tree
// stays clean. Editing a doc must never block a release, so a failure is
// reported and skipped rather than thrown.
//
// The CHANGELOG is the only file here. `FEATURES.md` is a "state of the board"
// report that lags by design — it says which version it was written against
// rather than claiming to describe the newest one — so there is nothing in it
// for a release to stamp, and asking for a line mentioning the version only
// ever produced a warning nobody could act on from a release run.
{
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const file = 'CHANGELOG.md'

  try {
    const lines = readFileSync(file, 'utf8').split('\n')
    // Only lines naming the version being released, so an unrelated 待发布
    // elsewhere in the file is left alone.
    if (!lines.some((line) => line.includes(`v${version}`))) {
      console.log(`⚠️  ${file} 里没有任何提到 v${version} 的行 —— 变更记录那一节写了吗？\n`)
    } else {
      const next = lines
        .map((line) => (line.includes(`v${version}`) ? line.replace(/待发布/g, today) : line))
        .join('\n')
      if (next !== lines.join('\n')) {
        writeFileSync(file, next)
        console.log(`📝 已把 ${file} 里 v${version} 的「待发布」写成 ${today}，记得连同本次改动一起提交。\n`)
      }
    }
  } catch (err) {
    console.log(`⚠️  ${file} 未能更新（${err.message}）——不影响发布。`)
  }
}
