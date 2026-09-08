// W2.5 — OData v2 scalar decoding, driven by the declared contract type
// rather than by what a value happens to look like.
//
// Three traps this exists to avoid, all of them real in this system:
//   1. `Edm.Decimal` arrives as a string ("1234.56") and silently becomes
//      string concatenation if not parsed.
//   2. `PurchaseOrderItemSet.Netpr`/`.Netwr` are declared `Edm.String` but
//      hold numerals. Guessing by shape would coerce them to numbers and lose
//      SAP's own intent — so decoding is by declared type, never by sniffing.
//   3. SAP material numbers are zero-padded strings ("000000000012345").
//      Parsing one as a number destroys the identifier and makes later joins
//      match nothing.

import type { EdmType } from "./types"

/** Time of day, as carried by `Edm.Time` — not an instant, so not a Date. */
export interface EdmTimeOfDay {
  hours: number
  minutes: number
  seconds: number
}

const EDM_DATETIME = /^\/Date\((-?\d+)([+-]\d+)?\)\/$/
const EDM_TIME = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/

/** `/Date(1757280000000)/` -> Date. The offset suffix, when present, is already applied by SAP. */
export function parseEdmDateTime(raw: string): Date {
  const match = EDM_DATETIME.exec(raw)
  if (!match) throw new Error(`Not an Edm.DateTime value: ${JSON.stringify(raw)}`)
  return new Date(Number(match[1]))
}

/** `PT14H16M00S` -> time of day. Never feed this to a date parser. */
export function parseEdmTime(raw: string): EdmTimeOfDay {
  const match = EDM_TIME.exec(raw)
  if (!match) throw new Error(`Not an Edm.Time value: ${JSON.stringify(raw)}`)
  return {
    hours: Number(match[2] ?? 0),
    minutes: Number(match[3] ?? 0),
    seconds: Math.trunc(Number(match[4] ?? 0)),
  }
}

/** `"1234.56"` -> 1234.56. Rejects junk rather than yielding NaN downstream. */
export function parseEdmDecimal(raw: string): number {
  const parsed = Number(raw)
  if (raw.trim() === "" || Number.isNaN(parsed)) {
    throw new Error(`Not an Edm.Decimal value: ${JSON.stringify(raw)}`)
  }
  return parsed
}

export type DecodedValue = string | number | boolean | Date | EdmTimeOfDay | null

/**
 * Decode one raw OData v2 value using its declared contract type. A `null`
 * stays `null` — absent is not zero, and not an empty string.
 */
export function decodeEdmValue(type: EdmType, raw: unknown): DecodedValue {
  if (raw === null || raw === undefined) return null

  switch (type) {
    case "Edm.DateTime":
    case "Edm.DateTimeOffset":
      return parseEdmDateTime(String(raw))
    case "Edm.Time":
      return parseEdmTime(String(raw))
    case "Edm.Decimal":
    case "Edm.Double":
    case "Edm.Single":
    case "Edm.Int64":
      return parseEdmDecimal(String(raw))
    case "Edm.Byte":
    case "Edm.SByte":
    case "Edm.Int16":
    case "Edm.Int32":
      return typeof raw === "number" ? raw : parseEdmDecimal(String(raw))
    case "Edm.Boolean":
      return typeof raw === "boolean" ? raw : String(raw) === "true"
    // Everything else stays exactly as SAP sent it. This is the Netpr case and
    // the zero-padded-Matnr case, and it is deliberate in both.
    case "Edm.String":
    case "Edm.Guid":
    case "Edm.Binary":
      return String(raw)
  }
}
