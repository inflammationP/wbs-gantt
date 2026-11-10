import { strFromU8, unzipSync } from 'fflate'
import { SheetCellValue, SheetGrid } from './courseSheet'

/**
 * The smallest .xlsx reader this app needs.
 *
 * An .xlsx is a zip of XML: shared strings, one workbook listing the sheets,
 * and one XML file per sheet. That is all a timetable needs, so there is no
 * spreadsheet library here — the only dependency is `fflate`, for the zip.
 * Formulas, styles and number formats are deliberately ignored: a course cell
 * is text, and a date cell that is stored as a serial is recognised as a date
 * by its value, not by its style.
 *
 * This module uses `DOMParser`, so it is browser-only. Checks that want the
 * parsing rules call `lib/courseSheet.ts` with a hand-built `SheetGrid`.
 */

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

export interface XlsxWorkbook {
  sheets: SheetGrid[]
  /** The first year of the `2026-2027-1` label, when the workbook has one. */
  startYear: number | null
}

/** A file this reader cannot open, with a reason the UI can translate. */
export class XlsxError extends Error {
  constructor(readonly code: 'not_zip' | 'no_workbook' | 'bad_format') {
    super(code)
  }
}

function parseXml(bytes: Uint8Array): Document {
  return new DOMParser().parseFromString(strFromU8(bytes), 'application/xml')
}

/** Descendants by local name, whichever namespace the file happens to use. */
function elements(node: Document | Element, local: string): Element[] {
  return [...node.getElementsByTagNameNS('*', local)]
}

function targetPath(target: string): string {
  const path = target.replace(/^\/+/, '')
  return path.startsWith('xl/') ? path : `xl/${path}`
}

function cellValue(cell: Element, shared: string[]): SheetCellValue | null {
  const type = cell.getAttribute('t')
  if (type === 's') {
    const index = Number(elements(cell, 'v')[0]?.textContent ?? '')
    return Number.isInteger(index) ? shared[index] ?? '' : ''
  }
  if (type === 'inlineStr') {
    return elements(cell, 't')
      .map((t) => t.textContent ?? '')
      .join('')
  }
  const raw = elements(cell, 'v')[0]?.textContent ?? ''
  if (raw === '') return null
  const number = Number(raw)
  return Number.isFinite(number) ? number : raw
}

export function readXlsx(buffer: ArrayBuffer): XlsxWorkbook {
  // A zip can claim to expand far past what its download size suggests. Only
  // the workbook's own XML is needed, and a timetable is nowhere near these
  // caps, so anything larger is not this kind of file.
  let expanded = 0
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (file) => {
        if (!file.name.startsWith('xl/')) return false
        if (file.originalSize > 20 * 1024 * 1024 || expanded + file.originalSize > 60 * 1024 * 1024) {
          return false
        }
        expanded += file.originalSize
        return true
      },
    })
  } catch {
    // fflate's own text ("invalid zip data") is not something a user can act on.
    throw new XlsxError('not_zip')
  }
  if (!files['xl/workbook.xml']) throw new XlsxError('no_workbook')

  const shared: string[] = []
  if (files['xl/sharedStrings.xml']) {
    for (const si of elements(parseXml(files['xl/sharedStrings.xml']), 'si')) {
      shared.push(
        elements(si, 't')
          .map((t) => t.textContent ?? '')
          .join(''),
      )
    }
  }

  const rels = new Map<string, string>()
  if (files['xl/_rels/workbook.xml.rels']) {
    for (const rel of elements(parseXml(files['xl/_rels/workbook.xml.rels']), 'Relationship')) {
      const id = rel.getAttribute('Id')
      const target = rel.getAttribute('Target')
      if (id && target) rels.set(id, targetPath(target))
    }
  }

  const sheets: SheetGrid[] = []
  for (const sheet of elements(parseXml(files['xl/workbook.xml']), 'sheet')) {
    const id = sheet.getAttributeNS(REL_NS, 'id') ?? sheet.getAttribute('r:id') ?? ''
    const path = rels.get(id)
    if (!path || !files[path]) continue

    const doc = parseXml(files[path])
    const cells = new Map<string, SheetCellValue>()
    for (const cell of elements(doc, 'c')) {
      const ref = cell.getAttribute('r')
      if (!ref) continue
      const value = cellValue(cell, shared)
      if (value !== null && value !== '') cells.set(ref.toUpperCase(), value)
    }
    const merges = elements(doc, 'mergeCell')
      .map((merge) => merge.getAttribute('ref') ?? '')
      .filter(Boolean)
    sheets.push({ name: sheet.getAttribute('name') ?? '', cells, merges })
  }

  return { sheets, startYear: findStartYear(sheets) }
}

/**
 * The academic label is a plain string cell in the header; read it wherever it
 * sits rather than assuming a cell address.
 */
function findStartYear(sheets: SheetGrid[]): number | null {
  for (const sheet of sheets) {
    for (const value of sheet.cells.values()) {
      if (typeof value !== 'string') continue
      const match = value.match(/(20\d{2})\s*[-–/]\s*(20\d{2})/)
      if (match) return Number(match[1])
    }
  }
  return null
}

type SheetJs = typeof import('@e965/xlsx')

function fromSheetJs(XLSX: SheetJs, name: string, ws: import('@e965/xlsx').WorkSheet): SheetGrid {
  const cells = new Map<string, SheetCellValue>()
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        const cell = ws[ref] as { t?: string; v?: unknown } | undefined
        if (!cell || cell.t === 'e' || cell.t === 'b') continue
        const value = cell.v
        if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
          if (value !== '') cells.set(ref, value)
        }
      }
    }
  }
  const merges = (ws['!merges'] ?? []).map((merge) => XLSX.utils.encode_range(merge))
  return { name, cells, merges }
}

async function readWithSheetJs(buffer: ArrayBuffer): Promise<XlsxWorkbook> {
  let XLSX: SheetJs
  try {
    XLSX = await import('@e965/xlsx')
  } catch {
    throw new XlsxError('bad_format')
  }
  try {
    // Old .xls files may use a legacy codepage; without these tables their text
    // comes out garbled. Optional: the file still opens if the chunk fails.
    XLSX.set_cptable(await import('@e965/xlsx/dist/cpexcel.full.mjs'))
  } catch {
    // Keep going with the built-in UTF-16 handling.
  }
  try {
    const book = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const sheets = book.SheetNames.map((name) => fromSheetJs(XLSX, name, book.Sheets[name]))
    return { sheets, startYear: findStartYear(sheets) }
  } catch {
    throw new XlsxError('bad_format')
  }
}

/**
 * Read any Excel workbook a school may hand out.
 *
 * `.xlsx/.xlsm` are zip+XML and go through the small reader above. Old binary
 * `.xls/.xlsb` are not, so SheetJS is loaded on demand — only for those files,
 * and from its official build because the npm copy is stale and vulnerable.
 */
export async function readWorkbook(buffer: ArrayBuffer): Promise<XlsxWorkbook> {
  try {
    return readXlsx(buffer)
  } catch (err) {
    if (!(err instanceof XlsxError)) throw err
    return readWithSheetJs(buffer)
  }
}
