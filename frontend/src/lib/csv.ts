/** Minimal RFC4180-ish CSV parser — quoted fields, embedded commas, escaped
 * quotes ("") and CRLF/LF all handled. No external dependency needed for the
 * simple, comma-only data files this app loads. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ""
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      pushField()
    } else if (char === "\n") {
      pushRow()
    } else if (char === "\r") {
      // skip — a following \n (if any) ends the row
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) pushRow()

  return rows.filter((r) => r.length > 1 || r[0] !== "")
}

/** Parses CSV text into header-keyed record objects (all values are strings). */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return []
  const [header, ...body] = rows
  return body.map((cols) => {
    const record: Record<string, string> = {}
    header.forEach((key, i) => {
      record[key] = cols[i] ?? ""
    })
    return record
  })
}
