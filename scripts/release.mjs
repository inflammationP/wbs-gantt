#!/usr/bin/env node
// One-command release: record notes + commit that record + build + sign +
// generate latest.json + publish via gh.
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

/**
 * One yes/no line. `askLines` ends on a blank line; this one ends on Enter.
 *
 * A release note is a block, but "is this one important?" is a single decision
 * and needs a single keystroke — a default of "no" so a rushed release is not
 * made important by a stray Enter.
 */
function askYesNo(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(/^y(es)?$/i.test(answer.trim()))
    })
  })
}

function run(cmd) {
  console.log(`\n> ${cmd}\n`)
  execSync(cmd, { stdio: 'inherit' })
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim()
}

/**
 * Tracked files a release run may leave modified: the two it writes, plus the
 * lockfile a build can refresh after a dependency change.
 */
const RELEASE_FILES = ['src/lib/releaseHistory.json', 'CHANGELOG.md', 'src-tauri/Cargo.lock']

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

// 1b. a release starts from a commit, not from a working tree
//
// The build packages whatever is on disk, and the tag is made on GitHub after
// this run — so anything uncommitted here would ship without ever reaching the
// repository. Compared by content (`git diff`), not by `git status`: on Windows
// a checkout with the wrong line endings can leave a file listed as modified
// while its bytes are identical, and that must not block a release.
//
// The two files below are the exception: an interrupted release leaves them
// modified, and the next run rewrites and commits them. Untracked files count
// too — an import from one would ship code no commit names.
const dirty = [
  ...git('diff --name-only HEAD').split('\n'),
  ...git('ls-files --others --exclude-standard').split('\n'),
].filter(Boolean)
const blocking = dirty.filter((path) => !RELEASE_FILES.includes(path))
if (blocking.length) {
  console.error('\n⚠️  工作区有未提交的改动。发版必须从一次提交出发，先提交或 stash：')
  for (const path of blocking) console.error(`   ${path}`)
  console.error('')
  process.exit(1)
}

// One line per point; a blank line ends the block and the dashes are added by
// `asList`. Markdown inside a line is fine and passes through.
const typedNotes = await askLines(
  '\nRelease notes — one line per point, blank line to finish (Enter alone to skip):\n> ',
)

// The important flag rides *inside* the notes, as a first line the app strips
// before showing them. It has to: the dialog reading this manifest is an older
// build and cannot be told about a release it predates any other way. The line
// is also legible in the GitHub body, where it reads as a badge.
const important =
  typedNotes.trim() !== '' &&
  (await askYesNo('\nMark this as an important update? The dialog will make people read the notes. [y/N] '))

const notes = (important ? '[重要]\n' : '') + asList(typedNotes)

const tag = `v${version}`
const setupName = `${conf.productName}_${version}_x64-setup.exe`
const sigPath = `src-tauri/target/release/bundle/nsis/${setupName}.sig`
const exePath = `src-tauri/target/release/bundle/nsis/${setupName}`

// 2. the history the build carries
//
// Settings reads release notes from the bundle rather than fetching them, so
// the version being built has to be in `releaseHistory.json` before the build.
// Replacing this version's entry rather than adding a second one makes a retry
// after a failed publish safe. The notes here are the same block that becomes
// the GitHub release body below, so the two cannot drift.
const historyPath = 'src/lib/releaseHistory.json'
const history = JSON.parse(readFileSync(historyPath, 'utf8')).filter((r) => r.version !== version)
writeFileSync(historyPath, JSON.stringify([{ version, notes }, ...history], null, 2) + '\n')
console.log(`📝 ${historyPath} 已加入 v${version}（第 4 步随发版提交）。\n`)

// 2b. stamp the release date into the changelog — a fallback, not the normal
// path. The heading is meant to carry its real date already: a section is
// written once, finished, and released as it stands. This only fires for a
// 待发布 placeholder that survived — a section written days before the release,
// whose date nobody re-checked. Editing a doc must never block a release, so a
// failure is reported and skipped rather than thrown.
//
// It runs here, before the build, because the release commit in step 4 has to
// carry every file this run wrote. The old position at the end left the date in
// the working tree after the release was already public.
//
// The CHANGELOG is the only file here. `FEATURES.md` is a "state of the board"
// report that lags by design — it says which version it was written against
// rather than claiming to describe the newest one — so there is nothing in it
// for a release to stamp.
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
        console.log(`📝 已把 ${file} 里 v${version} 的「待发布」写成 ${today}（第 4 步随发版提交）。\n`)
      }
    }
  } catch (err) {
    console.log(`⚠️  ${file} 未能更新（${err.message}）——不影响发布。`)
  }
}

// 3. build with signing
process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(KEY_PATH, 'utf8').replace(/[\r\n]+$/, '')
process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
run('npm run tauri build')

// 4. commit and push the release bookkeeping
//
// This is the half the old script left to memory ("记得连同本次改动一起提
// 交"), and forgetting it was silent: the build carried the entry, so the
// release looked complete, while the repository — and every build cloned from
// it — was missing that version's notes for good. The push happens before the
// GitHub release is created so the tag points at a commit that contains the
// history the installer was built with.
//
// Retry-safe: a second run rewrites the same entry, `git diff` sees no change,
// and only the push runs.
//
// `-a` rather than a pathspec: the guard in 1b means the tree was clean when
// this run started, so every tracked change now is either this run's writing or
// something the build itself updated (`Cargo.lock`). Both belong in the commit
// the tag will name. Untracked files would not be committed, so they abort the
// release instead of shipping unrecorded.
const untracked = git('ls-files --others --exclude-standard').split('\n').filter(Boolean)
if (untracked.length) {
  console.error('\n⚠️  构建后出现了未跟踪的文件，发版会漏掉它们。先提交或加入 .gitignore 再重跑：')
  for (const path of untracked) console.error(`   ${path}`)
  console.error('')
  process.exit(1)
}
const changed = git('diff --name-only HEAD').split('\n').filter(Boolean).length > 0
if (changed) {
  run(`git commit -am "${version}: release bookkeeping"`)
} else {
  console.log('\n✓ 工作区与 HEAD 一致，无需提交。')
}
try {
  run('git push')
} catch {
  console.error(`\n⚠️  发版记录已提交，但推送失败。修好远端后重新运行本脚本即可。\n`)
  process.exit(1)
}

// 5. the update manifest
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

// 6. publish via GitHub CLI
// The release starts as a draft: releases/latest keeps serving the previous
// manifest until this one is complete. A live release whose latest.json is
// missing or points at a 404 silently stops updates for every user, and keeps
// doing it until somebody notices.
const notesFile = '.release-notes.md'
writeFileSync(notesFile, notes || 'No release notes.')

let draftOpen = false
try {
  // The tag is pinned to the commit that was just built and pushed, rather than
  // whatever the remote's default branch happens to be by then.
  const head = git('rev-parse HEAD')
  run(`gh release create ${tag} "${exePath}" --draft --target ${head} --title "${tag}" --notes-file ${notesFile} --repo ${REPO}`)
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
