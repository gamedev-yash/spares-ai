import Papa from "papaparse";

// Per-file in-memory cache so each CSV under /public/data/ is fetched and parsed at most
// once per browser session, no matter how many components/pages ask for it.
const cache = new Map<string, Promise<Record<string, string>[]>>();

function parseCsv(path: string): Promise<Record<string, string>[]> {
  return fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
      return res.text();
    })
    .then(
      (text) =>
        new Promise<Record<string, string>[]>((resolve, reject) => {
          Papa.parse<Record<string, string>>(text, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => resolve(result.data),
            error: (err: Error) => reject(err),
          });
        }),
    );
}

/** Fetches + parses a CSV under /public/data/ (cached after the first call) and maps each
 * raw string-keyed row into a typed row via `mapRow`. Raw fields are always strings (or ""
 * for blank cells) -- all numeric/boolean coercion happens explicitly in `mapRow` so the
 * types stay honest about what the CSV actually contains. */
export async function loadCsv<T>(path: string, mapRow: (row: Record<string, string>) => T): Promise<T[]> {
  let pending = cache.get(path);
  if (!pending) {
    pending = parseCsv(path);
    cache.set(path, pending);
  }
  const rows = await pending;
  return rows.map(mapRow);
}

// --- shared field coercion helpers -----------------------------------------------------

/** "true"/"false" (lowercase, as written by the Python generator) -> boolean. */
export function bool(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "true";
}

export function num(value: string | undefined): number {
  if (value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

/** Blank cells (e.g. service_level_target_pct, z_factor -- pending sign-off) become null,
 * never an empty string, so UI code can use a single `?? "Not set"`-style check. */
export function strOrNull(value: string | undefined): string | null {
  const v = (value ?? "").trim();
  return v === "" ? null : v;
}
