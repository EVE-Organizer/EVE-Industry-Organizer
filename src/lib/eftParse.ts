export interface ParsedEftLine {
  name: string
  quantity: number
  chargeName?: string
  emptySlot: boolean
}

export interface ParsedEftFit {
  hullName: string
  fitName: string
  lines: ParsedEftLine[]
  unknown: string[]
}

const HEADER_RE = /^\s*\[([^,\]]+)(?:\s*,\s*([^\]]+))?\]\s*$/
const EMPTY_RE = /^\[empty/i
const QTY_RE = /^(.*?)\s+x\s*(\d+)?\s*$/i

export function parseEft(text: string): ParsedEftFit {
  const rawLines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  let hullName = ''
  let fitName = ''
  const lines: ParsedEftLine[] = []
  const unknown: string[] = []

  for (const raw of rawLines) {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (!hullName) {
      const header = HEADER_RE.exec(trimmed)
      if (header) {
        hullName = header[1]!.trim()
        fitName = header[2]?.trim() ?? ''
        continue
      }
      unknown.push(trimmed)
      continue
    }

    if (EMPTY_RE.test(trimmed)) {
      lines.push({ name: trimmed, quantity: 0, emptySlot: true })
      continue
    }

    const [itemPart, chargePart] = splitCharge(trimmed)
    const qtyMatch = QTY_RE.exec(itemPart)
    const name = (qtyMatch ? qtyMatch[1]! : itemPart).trim()
    const quantity = qtyMatch?.[2] ? Number(qtyMatch[2]) : 1
    if (!name) continue
    lines.push({
      name,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      chargeName: chargePart,
      emptySlot: false,
    })
  }

  return { hullName, fitName, lines, unknown }
}

function splitCharge(line: string): [string, string | undefined] {
  const comma = line.indexOf(',')
  if (comma < 0) return [line, undefined]
  const item = line.slice(0, comma).trim()
  const charge = line.slice(comma + 1).trim()
  return [item, charge || undefined]
}
