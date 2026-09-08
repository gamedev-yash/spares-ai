// W2.6a — a fake CPI that speaks the real double-envelope protocol.
//
// It reproduces the CURRENT LIVE STATE on purpose (§7.3), because a mock that
// is healthier than production hides exactly the problems we need to design
// for:
//   - `$count` returns HTTP 500 on the two sets where it really does.
//   - `ReservationItemSet` / `MaterialValuationSet` can be made to return zero
//     rows, matching §1.3, so we can prove the app degrades honestly instead
//     of discovering it on Azure day.
//
// Node-only, dev/test infrastructure. It never ships.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { readFileSync } from "node:fs"
import { SAP_CONTRACT } from "../contract/generated-contract"
import { COUNT_BROKEN_SETS, EMPTY_SETS } from "../contract/known-conditions"
import { loadEntitySet, type RawRow } from "./csv-source"
import { encodeRow } from "./encode"
import { applyQuery, parseQueryString } from "./query"
import { FilterParseError } from "./odata-filter-parser"

export interface GatewayOptions {
  port?: number
  /** Reproduce §1.3: the three live sets that return nothing. On by default. */
  simulateEmptySets?: boolean
  /** Reproduce the two sets whose `$count` really is broken. On by default. */
  simulateBrokenCount?: boolean
  cpiPath?: string
}

const CPI_PATH = "/http/SAPECC/OdataConsumption"
const TOKEN_PATH = "/oauth/token"

/** `sap/opu/odata/sap/<service>/<EntitySet>[/$count]` or `.../$metadata`. */
function parseApiPath(apiPath: string): { service: string; entitySet?: string; isCount: boolean; isMetadata: boolean } {
  const parts = apiPath.replace(/^\/+/, "").split("/")
  const service = parts[4] ?? ""
  const tail = parts.slice(5)
  return {
    service,
    entitySet: tail[0] === "$metadata" ? undefined : tail[0],
    isCount: tail[1] === "$count",
    isMetadata: tail[0] === "$metadata",
  }
}

export function createGateway(options: GatewayOptions = {}): Server {
  const simulateEmptySets = options.simulateEmptySets ?? true
  const simulateBrokenCount = options.simulateBrokenCount ?? true
  const cpiPath = options.cpiPath ?? CPI_PATH

  const rowsFor = (entitySet: string): RawRow[] => {
    if (simulateEmptySets && (EMPTY_SETS as readonly string[]).includes(entitySet)) return []
    return loadEntitySet(entitySet) ?? []
  }

  return createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://localhost")

    if (url.pathname === TOKEN_PATH) {
      return json(response, 200, { access_token: "fake-token", expires_in: 3600, token_type: "bearer" })
    }

    if (url.pathname !== cpiPath) {
      return text(response, 404, `No route for ${url.pathname}`)
    }

    const apiPath = url.searchParams.get("APIPath")
    if (!apiPath) return text(response, 400, "APIPath is required — this is the CPI double envelope")
    const apiQuery = url.searchParams.get("APIQuery") ?? ""

    const target = parseApiPath(apiPath)

    if (target.isMetadata) {
      try {
        const xml = readFileSync(`./data-generator/discovery/metadata_${target.service}.xml`, "utf-8")
        response.writeHead(200, { "Content-Type": "application/xml" })
        return response.end(xml)
      } catch {
        return text(response, 404, `No captured $metadata for service ${target.service}`)
      }
    }

    const entitySet = target.entitySet
    if (!entitySet || !SAP_CONTRACT[entitySet]) {
      return text(response, 404, `Unknown entity set: ${entitySet}`)
    }

    if (target.isCount) {
      if (simulateBrokenCount && (COUNT_BROKEN_SETS as readonly string[]).includes(entitySet)) {
        // Exactly what live SAP does today — and the reason W2.3 needs a fallback.
        return text(response, 500, "Internal Server Error")
      }
      try {
        const query = parseQueryString(apiQuery)
        const matched = applyQuery(rowsFor(entitySet), { filter: query.filter })
        response.writeHead(200, { "Content-Type": "text/plain" })
        return response.end(String(matched.length))
      } catch (error) {
        return text(response, 400, `Bad filter: ${(error as Error).message}`)
      }
    }

    try {
      const query = parseQueryString(apiQuery)
      const matched = applyQuery(rowsFor(entitySet), query)
      const results = matched.map((row) => encodeRow(entitySet, row, query.select))
      return json(response, 200, { d: { results } })
    } catch (error) {
      if (error instanceof FilterParseError) return text(response, 400, error.message)
      return text(response, 500, (error as Error).message)
    }
  })
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" })
  response.end(JSON.stringify(body))
}

function text(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "Content-Type": "text/plain" })
  response.end(body)
}

/** Start the gateway and resolve once it is accepting connections. */
export function startGateway(options: GatewayOptions = {}): Promise<{ server: Server; port: number; baseUrl: string }> {
  const server = createGateway(options)
  return new Promise((resolve) => {
    server.listen(options.port ?? 0, () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : 0
      resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` })
    })
  })
}
