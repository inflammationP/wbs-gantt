/**
 * The one check on reading the school's timetable sheets, run with
 * `node scripts/check-course-sheet.mjs`.
 *
 * The xlsx reader itself needs a browser (`DOMParser`), but everything that
 * decides what a sheet means is pure and lives in `lib/courseSheet.ts`: which
 * row is the dates, which column is the time, where a merged course starts and
 * ends, and what the cell's text calls the course and the room. Those are the
 * parts that break silently, so they are what this pins down.
 *
 * Two layouts are covered because the real files have both: the early weeks
 * carry the days at columns C–Z, and the later ones add a French-time column
 * and shift everything one to the right. Dates arrive both as `2 novembre`
 * text and as Excel serial numbers.
 *
 * No clock is read: the week's Monday and every assertion day are arguments.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { strToU8, zipSync } from 'fflate'
import { DOMParser } from '@xmldom/xmldom'

// `lib/xlsx.ts` uses the browser's DOMParser; the check supplies the same
// interface from xmldom so the reader is exercised, not just the pure parser.
globalThis.DOMParser = DOMParser

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  // The reader pulls in fflate; without this the server's dependency scan runs
  // against the whole repo (including the Tauri build output) in the background.
  optimizeDeps: { noDiscovery: true, include: [] },
})
const {
  parseSheetWeek,
  parseSemesterStartYear,
  parseSheetDate,
  parseSheetTime,
  parseCourseText,
  parseCourseSheet,
  courseGroup,
  courseSemesterStart,
  courseWeekOf,
  coursesOn,
} = await server.ssrLoadModule('/src/lib/courseSheet.ts')

const sheet = (name, cells, merges = []) => ({
  name,
  cells: new Map(Object.entries(cells)),
  merges,
})

// --- the small pieces ------------------------------------------------------

assert.equal(parseSheetWeek('S11'), 11)
assert.equal(parseSheetWeek('s7'), 7)
assert.equal(parseSheetWeek('ORI'), null)
assert.equal(parseSemesterStartYear('2026-2027-1'), 2026)
assert.equal(parseSemesterStartYear('no year here'), null)

assert.equal(parseSheetDate('2 novembre ', 2026), '2026-11-02')
assert.equal(parseSheetDate('1 octobre  ', 2026), '2026-10-01')
assert.equal(parseSheetDate('5 février ', 2026), '2027-02-05', 'January–July are the label’s second year')
assert.equal(parseSheetDate(46335, null), '2026-11-09', 'Excel serial')
assert.equal(parseSheetDate('Date', 2026), null)

assert.deepEqual(parseSheetTime('Séance 1 8H00-8H45'), { start: '08:00', end: '08:45' })
assert.deepEqual(parseSheetTime('12H15-13H00'), { start: '12:15', end: '13:00' })
assert.deepEqual(parseSheetTime('Séance 11-13 19H00-21H30'), { start: '19:00', end: '21:30' })
assert.equal(parseSheetTime('Séance 1'), null)
assert.equal(parseSheetTime('9H00-8H00'), null)

assert.deepEqual(parseCourseText('体育（Ⅲ）\n（4-6,8-19(2学时)周[02-03节]）\n江阴运动场东跑道'), {
  title: '体育（Ⅲ）',
  location: '江阴运动场东跑道',
  note: '',
})
assert.deepEqual(
  parseCourseText("651218F1\nGraphique de l'ingénieur (I)\nCM 格物C302\nEddie WILLIG"),
  { title: "Graphique de l'ingénieur (I)", location: '格物C302', note: 'Eddie WILLIG' },
)
assert.deepEqual(parseCourseText('Mécanique théorique\nCM 致远B201/B203\nMourad KHELIFA\n（华越）'), {
  title: 'Mécanique théorique',
  location: '致远B201/B203',
  note: 'Mourad KHELIFA · （华越）',
})

assert.equal(courseGroup('Groupe S · WILLIG'), 'S')
assert.equal(courseGroup('Groupe M · TD2'), 'M')
assert.equal(courseGroup('Gr T'), 'T')
assert.equal(courseGroup('CM · Mourad KHELIFA'), null)

// --- the S11 layout: extra French-time column, days at D–AA ---------------

const TIMES = {
  B7: 'Séance 1 8H00-8H45',
  B8: 'Séance 2 8H50-9H35',
  B9: 'Séance 3 9H40-10H25',
  B10: 'Séance 4 10H40-11H25',
  B11: 'Séance 5 11H30-12H15',
  B12: '12H15-13H00',
  B13: '13H15-14H00',
  B14: 'Séance 6 14H00-14H45',
  B15: 'Séance 7 14H50-15H35',
  B16: 'Séance 8 15H50-16H35',
  B17: 'Séance 9 16H40-17H25',
  B18: 'Séance 10 17H30-18H15',
  B19: '18H15-19H00',
  B20: 'Séance 11-13 19H00-21H30',
}

const S11 = sheet(
  'S11',
  {
    C5: 'Date',
    D5: '2 novembre ',
    H5: '3 novembre',
    L5: '4 novembre ',
    P5: '5 novembre',
    T5: '6 novembre',
    X5: '7 novembre',
    Z5: '8 novembre ',
    AC5: 'Séances de la semaine S11',
    ...TIMES,
    D7: "651218F1\nGraphique de l'ingénieur (I)\nCM 格物C302\nEddie WILLIG",
    L7: '体育（Ⅲ）\n（4-6,8-19(2学时)周[02-03节]）\n江阴运动场东跑道',
    H10: '大学物理（Ⅱ）\n[王广安]\n（4-6,8-16(2学时)周[04-05节]）\n江阴工训中心阶梯教室4',
    T7: "651218F1\nGraphique de l'ingénieur (I)\nCM 格物C303\nEddie WILLIG",
    D20: 'Mécanique théorique\nCM 致远B201/B203\nMourad KHELIFA\n（华越）',
    AC7: 'not a class',
  },
  [
    'D5:G5',
    'H5:K5',
    'L5:O5',
    'P5:S5',
    'T5:W5',
    'X5:Y5',
    'Z5:AA5',
    'L7:O9',
    'H10:K11',
    'T7:W8',
    'D20:G22',
    'G7:G9',
  ],
)

const s11 = parseCourseSheet(S11, 2026)
assert.ok(s11, 'S11 parses')
assert.equal(s11.week, 11)
assert.equal(s11.monday, '2026-11-02')
assert.equal(s11.sessions.length, 5)

const monday8 = s11.sessions.find((s) => s.weekday === 0 && s.start === '08:00')
assert.deepEqual(
  { title: monday8.title, location: monday8.location, end: monday8.end },
  { title: "Graphique de l'ingénieur (I)", location: '格物C302', end: '08:45' },
)
const wednesday = s11.sessions.find((s) => s.weekday === 2)
assert.deepEqual(
  { title: wednesday.title, start: wednesday.start, end: wednesday.end },
  { title: '体育（Ⅲ）', start: '08:00', end: '10:25' },
  'a merged block ends at the last period it covers',
)
const tuesday = s11.sessions.find((s) => s.weekday === 1)
assert.deepEqual(
  { title: tuesday.title, start: tuesday.start, end: tuesday.end },
  { title: '大学物理（Ⅱ）', start: '10:40', end: '12:15' },
)
const friday = s11.sessions.find((s) => s.weekday === 4)
assert.deepEqual(
  { title: friday.title, start: friday.start, end: friday.end },
  { title: "Graphique de l'ingénieur (I)", start: '08:00', end: '09:35' },
)
const evening = s11.sessions.find((s) => s.start === '19:00')
assert.deepEqual(
  { title: evening.title, end: evening.end, note: evening.note },
  { title: 'Mécanique théorique', end: '21:30', note: 'Mourad KHELIFA · （华越）' },
)
assert.equal(s11.sessions.some((s) => s.title === 'not a class'), false, 'the summary column is outside the days')

// --- the S7 layout: days at C–Z, no French column -------------------------

const S7 = sheet(
  'S7',
  {
    C5: '5 octobre ',
    G5: '6 octobre ',
    K5: '7 octobre ',
    O5: '8 octobre ',
    S5: '9 octobre ',
    W5: '10 octobre ',
    Y5: '11 octobre ',
    ...TIMES,
    C10: '工程数学\n[刘禹彤]\n（4-8(2学时)周[04-05节]）\n江阴格物C101',
  },
  ['C5:F5', 'G5:J5', 'K5:N5', 'O5:R5', 'S5:V5', 'W5:X5', 'Y5:Z5', 'C10:F11'],
)
const s7 = parseCourseSheet(S7, 2026)
assert.ok(s7)
assert.equal(s7.week, 7)
assert.equal(s7.monday, '2026-10-05')
assert.deepEqual(
  { title: s7.sessions[0].title, weekday: s7.sessions[0].weekday, start: s7.sessions[0].start, end: s7.sessions[0].end },
  { title: '工程数学', weekday: 0, start: '10:40', end: '12:15' },
)

// --- a sheet whose dates are Excel serials --------------------------------

const S12 = sheet(
  'S12',
  {
    D5: 46335,
    H5: 46336,
    L5: 46337,
    P5: 46338,
    T5: 46339,
    X5: 46340,
    Z5: 46341,
    ...TIMES,
    D7: '数值分析\n[老师]\n（12-19(2学时)周[01-02节]）\n格物C101',
  },
  ['D5:G5', 'H5:K5', 'L5:O5', 'P5:S5', 'T5:W5', 'X5:Y5', 'Z5:AA5'],
)
const s12 = parseCourseSheet(S12, null)
assert.ok(s12, 'numeric dates carry their own year')
assert.equal(s12.monday, '2026-11-09')
assert.equal(s12.sessions[0].start, '08:00')

// --- weeks and the day's slice --------------------------------------------

assert.equal(courseSemesterStart('2026-11-02', 11), '2026-08-24')
assert.equal(courseSemesterStart('2026-10-05', 7), '2026-08-24')

assert.equal(courseWeekOf('2026-11-05', '2026-08-24'), 11)
assert.equal(courseWeekOf('2026-08-24', '2026-08-24'), 1)
assert.equal(courseWeekOf('2026-08-23', '2026-08-24'), null)
assert.equal(courseWeekOf('2026-11-05', null), null)

const onMonday = coursesOn(s11.sessions, '2026-11-02', '2026-08-24')
assert.deepEqual(onMonday.map((c) => c.start), ['08:00', '19:00'])
assert.deepEqual(coursesOn(s11.sessions, '2026-11-09', '2026-08-24'), [], 'next week is not this week')
assert.deepEqual(coursesOn(s11.sessions, '2026-11-02', null), [], 'no semester start, no placement')

assert.equal(parseCourseSheet(sheet('ORI', {}, []), 2026), null)
assert.equal(parseCourseSheet(sheet('S9', { B7: 'Séance 1 8H00-8H45' }, []), 2026), null)

// --- from a zipped workbook to sessions ------------------------------------
//
// The reader is the one part that needs a browser API, so it is fed a real
// .xlsx built in memory: shared strings, an inline string, a merged course and
// the date merges. This is the seam a hand-written reader gets wrong.

const esc = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const shared = []
const sIndex = (value) => {
  let index = shared.indexOf(value)
  if (index < 0) {
    index = shared.length
    shared.push(value)
  }
  return index
}
const cell = (ref, value) => `<c r="${ref}" t="s"><v>${sIndex(value)}</v></c>`
const inline = (ref, value) =>
  `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`

const timeRows = [
  ['7', 'Séance 1 8H00-8H45'],
  ['8', 'Séance 2 8H50-9H35'],
  ['9', 'Séance 3 9H40-10H25'],
  ['10', 'Séance 4 10H40-11H25'],
  ['11', 'Séance 5 11H30-12H15'],
  ['12', '12H15-13H00'],
  ['13', '13H15-14H00'],
  ['14', 'Séance 6 14H00-14H45'],
  ['15', 'Séance 7 14H50-15H35'],
  ['16', 'Séance 8 15H50-16H35'],
  ['17', 'Séance 9 16H40-17H25'],
  ['18', 'Séance 10 17H30-18H15'],
  ['19', '18H15-19H00'],
  ['20', 'Séance 11-13 19H00-21H30'],
]
const french = "651218F1\nGraphique de l'ingénieur (I)\nCM 格物C302\nEddie WILLIG"
const chinese = '体育（Ⅲ）\n（4-6,8-19(2学时)周[02-03节]）\n江阴运动场东跑道'

const sheetData = [
  `<row r="1">${cell('A1', '2026-2027-1')}</row>`,
  `<row r="5">${cell('C5', 'Date')}${cell('D5', '2 novembre ')}${cell('H5', '3 novembre')}${cell('L5', '4 novembre ')}${cell('P5', '5 novembre')}${cell('T5', '6 novembre')}${cell('X5', '7 novembre')}${cell('Z5', '8 novembre ')}</row>`,
  ...timeRows.map(([row, text]) => `<row r="${row}">${cell(`B${row}`, text)}</row>`),
  `<row r="7">${inline('D7', french)}${cell('L7', chinese)}</row>`,
].join('')

const sheetXml = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetData}</sheetData>
  <mergeCells>
    <mergeCell ref="D5:G5"/><mergeCell ref="H5:K5"/><mergeCell ref="L5:O5"/>
    <mergeCell ref="P5:S5"/><mergeCell ref="T5:W5"/><mergeCell ref="X5:Y5"/><mergeCell ref="Z5:AA5"/>
    <mergeCell ref="L7:O9"/>
  </mergeCells>
</worksheet>`

const sharedXml = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared
  .map((text) => `<si><t xml:space="preserve">${esc(text)}</t></si>`)
  .join('')}</sst>`

const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="S11" sheetId="1" r:id="rId1"/></sheets>
</workbook>`

const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`

const zip = zipSync({
  'xl/workbook.xml': strToU8(workbookXml),
  'xl/_rels/workbook.xml.rels': strToU8(relsXml),
  'xl/sharedStrings.xml': strToU8(sharedXml),
  'xl/worksheets/sheet1.xml': strToU8(sheetXml),
})

const { readXlsx, readWorkbook, XlsxError } = await server.ssrLoadModule('/src/lib/xlsx.ts')
const workbook = readXlsx(zip.buffer)

// A renamed or damaged download must be a translatable code, not fflate's text.
assert.throws(
  () => readXlsx(new Uint8Array([1, 2, 3, 4]).buffer),
  (err) => err instanceof XlsxError && err.code === 'not_zip',
)
assert.throws(
  () => readXlsx(zipSync({ 'hello.txt': strToU8('x') }).buffer),
  (err) => err instanceof XlsxError && err.code === 'no_workbook',
)

// Old binary .xls is not a zip: the on-demand SheetJS path must still read it.
const XLSX = await import('@e965/xlsx')
const legacyBook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(legacyBook, XLSX.utils.aoa_to_sheet([['2026-2027-1'], ['hello']]), 'S1')
const written = XLSX.write(legacyBook, { type: 'array', bookType: 'xls' })
const legacy = await readWorkbook(written instanceof ArrayBuffer ? written : written.buffer)
assert.equal(legacy.sheets.length, 1)
assert.equal(legacy.sheets[0].name, 'S1')
assert.equal(legacy.sheets[0].cells.get('A2'), 'hello')
assert.equal(legacy.startYear, 2026)
assert.equal(workbook.sheets.length, 1)
assert.equal(workbook.startYear, 2026)
const fromXlsx = parseCourseSheet(workbook.sheets[0], workbook.startYear)
assert.ok(fromXlsx, 'a zipped workbook parses')
assert.equal(fromXlsx.week, 11)
assert.equal(fromXlsx.monday, '2026-11-02')
assert.equal(fromXlsx.sessions.length, 2)
assert.deepEqual(
  fromXlsx.sessions.map((session) => [session.weekday, session.start, session.end, session.title]),
  [
    [0, '08:00', '08:45', "Graphique de l'ingénieur (I)"],
    [2, '08:00', '10:25', '体育（Ⅲ）'],
  ],
)

await server.close()
console.log('course sheet: ok')
