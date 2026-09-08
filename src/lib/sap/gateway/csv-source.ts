// W2.6a — load the generated synthetic CSVs as the gateway's row store.
//
// Node-only. The gateway is dev/test infrastructure and never ships to a
// browser.

import { existsSync, readFileSync } from "node:fs"
import { SAP_CONTRACT } from "../contract/generated-contract"

const GENERATED_SAP = "./data-generator/generated/sap"

export type RawRow = Record<string, string>

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      cells.push(current)
      current = ""
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

export function loadEntitySet(entitySet: string): RawRow[] | null {
  const path = `${GENERATED_SAP}/${entitySet}.csv`
  if (!existsSync(path)) return null

  const text = readFileSync(path, "utf-8").trim()
  if (!text) return []

  const lines = text.split(/\r?\n/)
  const header = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""]))
  })
}

/** Entity sets the generator produced a file for. */
export function availableEntitySets(): string[] {
  return Object.keys(SAP_CONTRACT).filter((entitySet) => existsSync(`${GENERATED_SAP}/${entitySet}.csv`))
}
