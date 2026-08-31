import { ILLUSTRATIVE_Z_FACTORS } from "./config";
import type { Criticality, Circuit, CriticalityPolicyRow } from "../data/types";

export interface ServiceLevelResult {
  z: number;
  isIllustrative: boolean;
  policyRow: CriticalityPolicyRow | null;
}

/** Step 4 -- looks up the governing criticality x circuit policy row. Every row in
 * criticality_policy.csv ships with a blank target/Z and status="PENDING_SIGNOFF" (see
 * that file's generator comment), so `z` here is ALWAYS the illustrative placeholder from
 * config.ts, never a real approved figure -- `isIllustrative` is returned mainly so the UI
 * has a single flag to key its "pending sign-off" styling off, in case a future data drop
 * fills these in for some criticality/circuit combinations but not others. */
export function resolveServiceLevel(
  criticality: Criticality,
  circuit: Circuit,
  policy: CriticalityPolicyRow[],
): ServiceLevelResult {
  const policyRow = policy.find((p) => p.criticality === criticality && p.circuit === circuit) ?? null;
  const signedOff = policyRow?.status === "APPROVED" && policyRow.z_factor !== null;

  return {
    z: signedOff ? Number(policyRow!.z_factor) : ILLUSTRATIVE_Z_FACTORS[criticality],
    isIllustrative: !signedOff,
    policyRow,
  };
}
