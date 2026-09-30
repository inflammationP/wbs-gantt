/**
 * The Chinese copy, out and back in.
 *
 *   node scripts/zh-copy.mjs                  → write docs/zh-copy.md
 *   node scripts/zh-copy.mjs --apply <file>   → read that table back into i18n.ts
 *
 * The dump lists every dictionary entry in declaration order, English beside the
 * Chinese, so the wording can be judged without opening the source. Applying goes
 * the other way: rows whose Chinese differs from `src/lib/i18n.ts` are written
 * into it, and rows that match are left alone, so re-running an apply is safe.
 *
 * The Chinese column holds the exact literal from the source — `\n` for a line
 * break, `\|` for a pipe — which is what makes this a straight substitution
 * rather than a re-escaping problem.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'src/lib/i18n.ts'
const OUT = 'docs/zh-copy.md'

/**
 * The body of `const <name>...= { ... }`, brace-matched, plus where it starts.
 *
 * Anchored to the start of a line: the file's own preamble quotes the shape of
 * the `zh` declaration as an example, and an unanchored search finds that first.
 */
function block(src, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const start = src.search(new RegExp(`^${escaped}`, 'm'))
  if (start < 0) throw new Error(`not found: ${marker}`)
  const open = src.indexOf('{', start)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (c === "'") {
      // An apostrophe in a comment is not a string opener, and this scanner has
      // to know that: these dictionaries explain themselves in prose, and one
      // "the row's number" used to make the quote-skipping run on past the
      // closing brace and swallow the two dictionaries below — which surfaced
      // as "1320 en vs 440 zh" rather than as anything pointing at the line.
      const line = src.slice(src.lastIndexOf('\n', i) + 1, i)
      if (line.includes('//')) continue
      i++
      while (i < src.length && !(src[i] === "'" && src[i - 1] !== '\\')) i++
      continue
    }
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) return { body: src.slice(open + 1, i), start: open + 1 }
  }
  throw new Error(`unbalanced: ${marker}`)
}

/**
 * The value starting at `from`: a quoted string, a `{ one, other }` object, or a
 * bracketed array.
 *
 * A scanner rather than a regex because `{count}` placeholders live inside the
 * strings, so brace counting has to skip quoted runs.
 */
function readValue(text, from) {
  let i = from
  while (i < text.length && /\s/.test(text[i])) i++
  const start = i
  if (text[i] === "'") {
    i++
    while (i < text.length) {
      if (text[i] === '\\') i += 2
      else if (text[i] === "'") return { raw: text.slice(start, ++i), start, end: i }
      else i++
    }
    throw new Error(`unterminated string at ${start}`)
  }
  if (text[i] === '{' || text[i] === '[') {
    const [open, close] = text[i] === '{' ? ['{', '}'] : ['[', ']']
    let depth = 0
    while (i < text.length) {
      if (text[i] === '\\') i += 2
      else if (text[i] === "'") {
        i++
        while (i < text.length && !(text[i] === "'" && text[i - 1] !== '\\')) i++
        i++
      } else if (text[i] === open) (depth++, i++)
      else if (text[i] === close && --depth === 0) return { raw: text.slice(start, ++i), start, end: i }
      else i++
    }
    throw new Error(`unbalanced ${open} at ${start}`)
  }
  throw new Error(`no value at ${start}`)
}

/** The displayable text of a value: the string itself, or `one / other`. */
export function shown(raw) {
  if (raw.startsWith("'")) return raw.slice(1, -1)
  const parts = []
  for (const form of ['one', 'other']) {
    const at = raw.search(new RegExp(`\\b${form}:`))
    if (at < 0) continue
    parts.push(readValue(raw, at + form.length + 1).raw.slice(1, -1))
  }
  return parts[0] === parts[1] ? parts[0] : `one: ${parts[0]} / other: ${parts[1]}`
}

/** One entry of a dictionary, with its value's absolute offsets in the source. */
function entries(src, marker) {
  const { body, start } = block(src, marker)
  const found = []
  for (const m of body.matchAll(/^[ \t]*\/\/ --- (.+?) ---|^[ \t]*'((?:[^'\\]|\\.)*)':/gm)) {
    if (m[1]) found.push({ group: m[1] })
    else {
      const value = readValue(body, m.index + m[0].length)
      found.push({
        key: m[2],
        value: { ...value, start: value.start + start, end: value.end + start },
      })
    }
  }
  let group = ''
  return found.filter((e) => {
    if (!e.key) group = e.group
    else e.group = group
    return e.key
  })
}

/** One row's cells, split on unescaped pipes and trimmed. */
function cells(line) {
  const out = []
  let cur = ''
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '|') (cur += '|', i++)
    else if (line[i] === '|') (out.push(cur), (cur = ''))
    else cur += line[i]
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** The table's rows, as key → Chinese. */
function readTable(path) {
  const rows = new Map()
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.startsWith('|')) continue
    const c = cells(line)
    if (c.length < 5 || !/^\d+$/.test(c[1])) continue
    rows.set(c[2].replace(/^`|`$/g, ''), c[4])
  }
  return rows
}

/** A TS string literal holding `text`, which is already escaped the way it was typed. */
function lit(text) {
  return `'${text.replace(/(^|[^\\])'/g, "$1\\'")}'`
}

const src = readFileSync(SRC, 'utf8')

function dump() {
  const en = entries(src, 'const en = {')
  const zh = entries(src, 'const zh: Dict = {')
  if (en.length !== zh.length) throw new Error(`${en.length} en vs ${zh.length} zh`)
  const byKey = new Map(zh.map((e) => [e.key, e.value]))

  const out = [
    '# 界面中文：全部文案',
    '',
    '这份表是**核对用的**，由 `node scripts/zh-copy.mjs` 从 `src/lib/i18n.ts` 生成。',
    '顺序就是代码里的顺序，左边是英文原文，右边是中文。要改哪一条，把**最后一列**写成你要的文字就行，',
    '改完跟我说，我照着写回 `src/lib/i18n.ts`。',
    '',
    '**注意**：重跑脚本会覆盖这份文件。所以改完先告诉我，不要自己再跑一遍。',
    '',
    '几条约定，照着填不会出错：',
    '',
    '- 空着 = 保持现在的样子',
    '- `{count}` `{name}` `{date}` 这类花括号是占位符，**必须原样留着**，位置可以挪',
    '- 单元格里的 `\\n` 是换行，`\\|` 是竖线，都照原样抄',
    '- `*……*`、`/……/` 是粗细和字号的排版标记，不要丢',
    '- `⟨空⟩` 表示这一条现在就是空的；想清空别的条目，也写 `⟨空⟩`',
    '- 首尾的空格（`›` 这类连接符两边有）在表里看不出来，要动那种单独跟我说一声',
    '- `one / other` 是单复数两套（中文里通常一样，重复的已经合并成一条）',
    '',
    '---',
    '',
  ]

  const HEAD = ['| # | key | English | 中文 |', '|---|-----|---------|------|']
  let n = 0
  let lastGroup = null
  let table = false
  for (const e of en) {
    if (e.group !== lastGroup) {
      lastGroup = e.group
      if (lastGroup) out.push('', `## ${lastGroup}`, '')
      table = false
    }
    if (!table) (out.push(...HEAD), (table = true))
    const value = shown(byKey.get(e.key).raw)
    out.push(
      `| ${++n} | \`${e.key}\` | ${shown(e.value.raw).replace(/\|/g, '\\|')} | ${
        value === '' ? '⟨空⟩' : value.replace(/\|/g, '\\|')
      } |`,
    )
  }

  // The three tables and the one Rust constant are displayable too, and none of
  // them is a dictionary entry.
  const extra = (label, marker) => {
    const body = block(src, marker).body
    out.push('', `### ${label}`, '', '```js', readValue(body, body.search(/\bzh:/) + 3).raw, '```')
  }
  out.push('', '---', '', '## 另外几处（不在字典里，结构不同）')
  extra('月份名 MONTHS.zh', 'const MONTHS: Record<Lang, string[]> = {')
  extra('星期名 WEEKDAYS.zh（周日在前）', 'const WEEKDAYS: Record<Lang, string[]> = {')
  extra('语言名的自称 LANG_LABEL.zh', 'export const LANG_LABEL: Record<Lang, string> = {')
  out.push(
    '',
    '`src-tauri/src/toast.rs` 里还有一个：`ACK_FALLBACK = "我知道了"` ——',
    '定时提醒进程没有前端，取不到字典，只能写死这一个按钮字。',
    '',
  )

  writeFileSync(OUT, out.join('\n'))
  console.log(`${n} entries -> ${OUT}`)
}

/**
 * Put a filled-in table back into the dictionary.
 *
 * The value is spliced where it stands rather than the entry being rebuilt, so a
 * plural keeps its two forms and the file keeps its own layout. Splicing from the
 * bottom up, because every offset above the last one written has already moved.
 */
function apply(path) {
  const rows = readTable(path)
  const ops = []
  let changed = 0

  for (const e of entries(src, 'const zh: Dict = {')) {
    const mine = shown(e.value.raw)
    const theirs = rows.get(e.key)
    // Compared trimmed, and written trimmed, because the table's own padding is
    // whitespace too. Untrimmed, a cell holding `' › '` reads back as plain `›`
    // and every separator in the file gets rewritten as a side effect of being
    // looked at — with no way to tell that apart from an editor that pads its
    // table columns. The cost is that leading and trailing spaces cannot be
    // changed from the table; those four values are edited in the source.
    if (theirs == null || theirs === (mine === '' ? '⟨空⟩' : mine).trim()) continue
    const text = theirs === '⟨空⟩' ? '' : theirs
    changed++

    if (e.value.raw.startsWith("'")) {
      ops.push({ start: e.value.start, end: e.value.end, text: lit(text) })
    } else {
      // Both forms of a plural carry the same Chinese — CLDR has no plural for
      // it — so one rewritten cell is written into each.
      for (const form of ['one', 'other']) {
        const at = e.value.raw.search(new RegExp(`\\b${form}:`))
        if (at < 0) continue
        const v = readValue(e.value.raw, at + form.length + 1)
        ops.push({ start: e.value.start + v.start, end: e.value.start + v.end, text: lit(text) })
      }
    }
  }

  let out = src
  for (const op of ops.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, op.start) + op.text + out.slice(op.end)
  }
  writeFileSync(SRC, out)
  console.log(`${changed} entries rewritten in ${SRC}`)
}

const [mode, arg] = process.argv.slice(2)
if (mode === '--apply') apply(arg)
else if (mode) throw new Error(`unknown argument: ${mode}`)
else dump()
