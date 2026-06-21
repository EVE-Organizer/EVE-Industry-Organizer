export function parseCsvRows(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const input = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    const next = input[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === ',') {
      row.push(field)
      field = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i++
      row.push(field)
      field = ''
      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
      continue
    }

    field += char
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

export function parseCsv(text) {
  const rows = parseCsvRows(text)
  if (!rows.length) return []
  const headers = rows[0]
  return rows.slice(1).map((values) => {
    const record = {}
    headers.forEach((header, index) => {
      record[header] = values[index] ?? ''
    })
    return record
  })
}

export async function fetchCsv(baseUrl, name, options = {}) {
  const { silent = false } = options
  const url = `${baseUrl}/${name}.csv`
  if (!silent) {
    process.stdout.write(`Fetching ${name}.csv…\n`)
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return parseCsv(await res.text())
}
