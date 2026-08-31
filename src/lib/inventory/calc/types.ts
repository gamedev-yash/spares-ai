import type { Circuit, Criticality } from "../data/types";

export type DemandClass = "Smooth" | "Erratic" | "Intermittent" | "Lumpy" | "OAR" | "NotStockManaged";
export type ConfidenceGrade = "HIGH" | "MEDIUM" | "LOW";
export type RiskBand = "Low" | "Medium" | "High" | "Critical" | "NotApplicable";

/** One row of the calculation trace -- structured, not a pre-formatted string, so the
 * "Technical details" drawer can render formula/inputs/result as separate table columns. */
export interface TraceStep {
  step: string;
  label: string;
  formula?: string;
  inputs?: Record<string, string>;
  result?: string;
  note?: string;
}

export interface CurrentVsRecommended {
  currentSafetyStock: number;
  currentROP: number;
  currentMaxStock: number;
  recommendedSafetyStock: number;
  recommendedROP: number;
  recommendedMaxStockOptionA: number; // EOQ-based
  recommendedMaxStockOptionB: number; // review-period-based
}

export interface UpcomingMaintenance {
  workOrder: string;
  plannedDate: string;
  requiredQty: number;
  maintenanceType: string;
}

export interface OarNeighborSummary {
  materialId: string;
  materialCode: string;
  description: string;
  combinedSimilarity: number;
}

export interface Recommendation {
  materialId: string;
  materialCode: string;
  description: string;
  materialGroup: string;
  circuit: Circuit | null;
  criticality: Criticality;
  plant: string;
  demandClass: DemandClass;
  confidence: ConfidenceGrade | "NotApplicable";
  isOAR: boolean;
  notStockManaged: boolean;
  current: CurrentVsRecommended;
  riskBefore: RiskBand;
  riskAfter: RiskBand;
  zFactor: number | null;
  zFactorIsIllustrative: boolean;
  policyStatus: string | null;
  trace: TraceStep[];
  reasons: string[];
  flags: string[];
  upcomingMaintenance: UpcomingMaintenance[];
  oarNeighbors: OarNeighborSummary[];
}
