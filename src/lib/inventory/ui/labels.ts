import type { Recommendation } from "../calc/types";
import type { UserRow } from "../data/types";
import { deriveReferenceNow } from "../calc/months";

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}

/** Picks a stand-in "requester" for the Approvals table/modal, at the user's request to
 * match the mockup's display (a named person, not "System"). Not a real requester record
 * -- these recommendations are system-computed -- so this deterministically assigns one of
 * the app's own demo END_USER accounts (users.csv, same synthetic pool the rest of
 * spares-ai already uses for RR requesters), preferring one at the material's own plant.
 * Same materialId always maps to the same person within a session. */
export function requesterFor(materialId: string, plant: string, users: UserRow[]): UserRow | null {
  const endUsers = users.filter((u) => u.role === "END_USER" && u.active);
  if (endUsers.length === 0) return null;
  const samePlant = endUsers.filter((u) => u.plant === plant);
  const pool = samePlant.length > 0 ? samePlant : endUsers;
  return pool[hashString(materialId) % pool.length];
}

/** The person who signs off a given APPROVAL_CHAIN stage. users.csv's `role` column uses the
 * same identifiers as APPROVAL_CHAIN (END_USER / ENGINEERING_MANAGER / COMMERCIAL_MANAGER /
 * WAREHOUSE_SUPERVISOR), so each stage resolves to a real account holding that role --
 * preferring one at the material's own plant. Deterministic: the same material always shows
 * the same person for the same stage, so per-stage attribution stays stable across renders. */
export function approverForStage(materialId: string, plant: string, users: UserRow[], stage: string): UserRow | null {
  const pool = users.filter((u) => u.role === stage && u.active);
  if (pool.length === 0) return null;
  const samePlant = pool.filter((u) => u.plant === plant);
  const chosen = samePlant.length > 0 ? samePlant : pool;
  return chosen[hashString(materialId + stage) % chosen.length];
}

/** A plausible "submitted on" date for the same stand-in requester -- deterministically
 * 1-30 days before the dataset's own reference date, not an arbitrary fixed date. */
export function requestedDateFor(materialId: string, window: string[]): string {
  const now = deriveReferenceNow(window);
  const daysAgo = 1 + (hashString(materialId + "date") % 30);
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export interface DueLabel {
  label: string;
  tone: "coral" | "text";
}

/** Not a fabricated calendar date -- an honest urgency bucket derived from the real risk
 * band, shared by the Approvals table and its review modal. */
export const DUE_LABEL: Record<string, DueLabel> = {
  Critical: { label: "Today", tone: "coral" },
  High: { label: "This week", tone: "text" },
  Medium: { label: "Next 2 weeks", tone: "text" },
  Low: { label: "No rush", tone: "text" },
};

/** The recommendation method that produced this material's SS/ROP/Max -- real provenance,
 * standing in for the mockup's "Requested by" (which implied a human submitted the change;
 * these are system-computed, not human-submitted, so a person's name would be fabricated). */
export function sourceLabel(r: Recommendation): string {
  if (r.isOAR) return "OAR similarity";
  if (r.demandClass === "Intermittent" || r.demandClass === "Lumpy") return "SBA forecast";
  return "Statistical";
}
