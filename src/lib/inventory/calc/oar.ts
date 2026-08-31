import type { MaterialRow } from "../data/types";
import { OAR_NEIGHBOR_COUNT } from "./config";

export interface OarNeighbor {
  material: MaterialRow;
  structuralSimilarity: number;
  textSimilarity: number;
  combinedSimilarity: number;
}

function tokenize(description: string): Set<string> {
  return new Set(
    description
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Step 6 -- finds the top-N most similar non-OAR physical materials for a cold-start
 * material, so its recommendation can be derived from comparable neighbors instead of its
 * own (missing) consumption history.
 *
 * Structured (Gower-style) similarity: criticality is a hard filter (non-matches are
 * excluded entirely, not just down-weighted); circuit and material group/type are
 * categorical 0-or-1 distances; price is a normalized numeric distance
 * (|Δprice| / price range across the candidate pool). The four are averaged, unweighted,
 * per Gower's method, then similarity = 1 - distance.
 *
 * Text similarity: word-overlap (Jaccard) on the material description. A real deployment
 * would embed descriptions with a sentence-transformer and use cosine similarity instead
 * -- this mockup has no ML model available client-side, so Jaccard is a deliberately crude
 * stand-in that still rewards shared terminology (e.g. "bearing", "50mm", "slurry pump"). */
export function findOarNeighbors(target: MaterialRow, candidates: MaterialRow[]): OarNeighbor[] {
  const pool = candidates.filter((m) => m.id !== target.id && m.criticality === target.criticality);
  if (pool.length === 0) return [];

  const prices = pool.map((m) => m.last_po_price);
  const priceRange = Math.max(...prices) - Math.min(...prices) || 1;
  const targetTokens = tokenize(target.description);

  const scored: OarNeighbor[] = pool.map((m) => {
    const circuitDist = m.circuit === target.circuit ? 0 : 1;
    const groupDist = m.material_group === target.material_group ? 0 : 1;
    const typeDist = m.material_type === target.material_type ? 0 : 1;
    const priceDist = Math.min(1, Math.abs(m.last_po_price - target.last_po_price) / priceRange);
    const structuralDistance = (circuitDist + groupDist + typeDist + priceDist) / 4;
    const structuralSimilarity = 1 - structuralDistance;
    const textSimilarity = jaccard(targetTokens, tokenize(m.description));

    return {
      material: m,
      structuralSimilarity,
      textSimilarity,
      combinedSimilarity: 0.5 * structuralSimilarity + 0.5 * textSimilarity,
    };
  });

  scored.sort((a, b) => b.combinedSimilarity - a.combinedSimilarity);
  return scored.slice(0, OAR_NEIGHBOR_COUNT);
}
