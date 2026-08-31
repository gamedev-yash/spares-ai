import { ADI_THRESHOLD, CV2_THRESHOLD, MIN_NONZERO_MONTHS, MIN_HISTORY_MONTHS } from "./config";
import { mean, sampleStdev } from "./stats";
import type { ConsumptionRow } from "../data/types";

export type StatisticalDemandClass = "Smooth" | "Erratic" | "Intermittent" | "Lumpy";

export interface ClassificationResult {
  demandClass: StatisticalDemandClass | "OAR";
  routedToOAR: boolean;
  gateReason: string | null;
  n: number; // months in the dataset-wide history window
  nNonZero: number; // months with qty_consumed > 0 for this material
  adi: number;
  cv2: number;
  muNz: number; // mean of non-zero monthly quantities
  sigmaNz: number; // sample stdev of non-zero monthly quantities
}

/** Step 1 -- history gate + ADI/CV² classification. `oarFlag` is checked in addition to
 * the gate thresholds per the spec ("OAR materials should naturally fail this gate anyway
 * ... but check both signals") -- the flag and the gate should agree by construction, but
 * a material could in principle carry the flag without having sparse-enough history (or
 * vice versa), and either signal alone is enough to route to the cold-start path. */
export function classifyMaterial(
  windowLength: number,
  materialConsumption: ConsumptionRow[],
  oarFlag: boolean,
): ClassificationResult {
  const nNonZero = materialConsumption.length;
  const qtys = materialConsumption.map((r) => r.qty_consumed);
  const muNz = mean(qtys);
  const sigmaNz = sampleStdev(qtys);

  const failsNonZeroGate = nNonZero < MIN_NONZERO_MONTHS;
  const failsHistoryGate = windowLength < MIN_HISTORY_MONTHS;

  if (oarFlag || failsNonZeroGate || failsHistoryGate) {
    const gateReason = oarFlag
      ? "oar_flag = true on materials.csv"
      : failsNonZeroGate
        ? `only ${nNonZero} non-zero month(s) of consumption, below the ${MIN_NONZERO_MONTHS}-month minimum`
        : `only ${windowLength} month(s) in the history window, below the ${MIN_HISTORY_MONTHS}-month minimum`;
    return {
      demandClass: "OAR",
      routedToOAR: true,
      gateReason,
      n: windowLength,
      nNonZero,
      adi: nNonZero > 0 ? windowLength / nNonZero : Number.POSITIVE_INFINITY,
      cv2: 0,
      muNz,
      sigmaNz,
    };
  }

  const adi = windowLength / nNonZero;
  const cv2 = muNz > 0 ? (sigmaNz / muNz) ** 2 : 0;

  let demandClass: StatisticalDemandClass;
  if (adi <= ADI_THRESHOLD && cv2 <= CV2_THRESHOLD) demandClass = "Smooth";
  else if (adi <= ADI_THRESHOLD && cv2 > CV2_THRESHOLD) demandClass = "Erratic";
  else if (adi > ADI_THRESHOLD && cv2 <= CV2_THRESHOLD) demandClass = "Intermittent";
  else demandClass = "Lumpy";

  return { demandClass, routedToOAR: false, gateReason: null, n: windowLength, nNonZero, adi, cv2, muNz, sigmaNz };
}
