import type { ParsedFit, ParsedFitItem } from '@/pages/FitSkills/types'

const HEADER = /^\s*\[([^,\]]+)(?:,\s*([^\]]*))?\]\s*$/
const QTY = /\s+x(\d+)\s*$/i

function parseLine(raw: string): ParsedFitItem | null {
  let line = raw.trim()
  if (!line) return null
  if (line.startsWith('[')) return null
  if (/^empty\b/i.test(line)) return null

  let offline = false
  if (line.startsWith('[-]')) {
    offline = true
    line = line.slice(3).trim()
  }
  if (/\b\/offline\b/i.test(line)) {
    offline = true
    line = line.replace(/\s*\/offline\b/gi, '').trim()
  }

  let quantity = 1
  const qtyMatch = line.match(QTY)
  if (qtyMatch) {
    quantity = Number(qtyMatch[1])
    line = line.slice(0, qtyMatch.index).trim()
  }

  const comma = line.indexOf(',')
  if (comma > 0) {
    return {
      name: line.slice(0, comma).trim(),
      quantity,
      chargeName: line.slice(comma + 1).trim() || undefined,
      offline,
    }
  }
  return { name: line, quantity, offline }
}

export function parseEft(text: string): ParsedFit {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let shipName = ''
  let fitName = ''
  const items: ParsedFitItem[] = []

  for (const raw of lines) {
    const header = raw.match(HEADER)
    if (header && !shipName) {
      shipName = header[1].trim()
      fitName = header[2]?.trim() ?? ''
      continue
    }
    const item = parseLine(raw)
    if (item) items.push(item)
  }

  if (!shipName) {
    throw new Error('Fit must start with [Ship Name, Fit Name]')
  }

  return { shipName, fitName, items }
}
