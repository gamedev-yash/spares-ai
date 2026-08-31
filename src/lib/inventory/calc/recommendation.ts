import type {
  SpareData,
  MaterialRow,
  ConsumptionRow,
  GoodsReceiptRow,
  MaintenanceOrderRow,
} from "../data/types";
import { deriveMonthWindow, deriveReferenceNow, addMonths } from "./months";
import { classifyMaterial } from "./classification";
import { forecastStatistical, forecastSBA } from "./forecast";
import { computeLeadTime } from "./leadTime";
import { resolveServiceLevel } from "./serviceLevel";
import { findOarNeighbors, type OarNeighbor } from "./oar";
import { riskFromRopRatio } from "./risk";
import { roundUp } from "./stats";
import {
  SBA_ALPHA,
  DEFAULT_ORDERING_COST,
  DEFAULT_HOLDING_RATE,
  REVIEW_PERIOD_MONTHS,
  HIGH_CONFIDENCE_MONTHS,
  MEDIUM_CONFIDENCE_MONTHS,
  HIGH_CONFIDENCE_GR_COUNT,
  MEDIUM_CONFIDENCE_GR_COUNT,
} from "./config";
import type { Recommendation, TraceStep, ConfidenceGrade, DemandClass } from "./types";

const CONFIDENCE_RANK: Record<ConfidenceGrade, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

function worseConfidence(a: ConfidenceGrade, b: ConfidenceGrade): ConfidenceGrade {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}

/** Step 7 -- confidence grade for materials that went through the statistical/SBA path. */
function statisticalConfidence(monthsPresent: number, grRecordCount: number, usedFallback: boolean): ConfidenceGrade {
  const historyLevel: ConfidenceGrade =
    monthsPresent >= HIGH_CONFIDENCE_MONTHS ? "HIGH" : monthsPresent >= MEDIUM_CONFIDENCE_MONTHS ? "MEDIUM" : "LOW";
  const grLevel: ConfidenceGrade =
    grRecordCount >= HIGH_CONFIDENCE_GR_COUNT ? "HIGH" : grRecordCount >= MEDIUM_CONFIDENCE_GR_COUNT ? "MEDIUM" : "LOW";
  const combined = worseConfidence(historyLevel, grLevel);
  return usedFallback ? worseConfidence(combined, "LOW") : combined;
}

/** Confidence grade for the OAR/cold-start path -- a different rule than Step 7, based on
 * neighbor count and similarity rather than history depth. */
function oarConfidence(neighbors: OarNeighbor[]): ConfidenceGrade {
  const count = neighbors.length;
  const best = neighbors[0]?.combinedSimilarity ?? 0;
  if (count >= 5 && best > 0.8) return "HIGH";
  if (count >= 3 || (best >= 0.6 && best <= 0.8)) return "MEDIUM";
  return "LOW";
}

export class RecommendationEngine {
  private readonly data: SpareData;
  private readonly window: string[];
  private readonly materialsById: Map<string, MaterialRow>;
  private readonly consumptionByMaterial: Map<string, ConsumptionRow[]>;
  private readonly goodsReceiptByMaterial: Map<string, GoodsReceiptRow[]>;
  private readonly maintenanceByMaterial: Map<string, MaintenanceOrderRow[]>;
  private readonly cache = new Map<string, Recommendation>();
  private readonly inFlight = new Set<string>();
  private allCache: Recommendation[] | null = null;

  constructor(data: SpareData) {
    this.data = data;
    this.window = deriveMonthWindow(data.consumptionHistory);
    this.materialsById = new Map(data.materials.map((m) => [m.id, m]));

    this.consumptionByMaterial = new Map();
    for (const row of data.consumptionHistory) {
      const list = this.consumptionByMaterial.get(row.material_id) ?? [];
      list.push(row);
      this.consumptionByMaterial.set(row.material_id, list);
    }

    this.goodsReceiptByMaterial = new Map();
    for (const row of data.goodsReceipt) {
      const list = this.goodsReceiptByMaterial.get(row.material_id) ?? [];
      list.push(row);
      this.goodsReceiptByMaterial.set(row.material_id, list);
    }

    this.maintenanceByMaterial = new Map();
    for (const row of data.maintenanceOrders) {
      const list = this.maintenanceByMaterial.get(row.material_id) ?? [];
      list.push(row);
      this.maintenanceByMaterial.set(row.material_id, list);
    }
  }

  getAllRecommendations(): Recommendation[] {
    if (!this.allCache) {
      this.allCache = this.data.materials.map((m) => this.getRecommendation(m.id));
    }
    return this.allCache;
  }

  getRecommendation(materialId: string): Recommendation {
    const cached = this.cache.get(materialId);
    if (cached) return cached;

    const material = this.materialsById.get(materialId);
    if (!material) throw new Error(`Unknown material id: ${materialId}`);

    // OAR neighbor lookups call back into getRecommendation() for (always non-OAR) other
    // materials -- this guards against a pathological self-reference, not a real cycle.
    if (this.inFlight.has(materialId)) {
      throw new Error(`Circular recommendation dependency detected for material ${materialId}`);
    }
    this.inFlight.add(materialId);
    const result = material.material_group === "Services" ? this.buildNotStockManaged(material) : this.build(material);
    this.inFlight.delete(materialId);

    this.cache.set(materialId, result);
    return result;
  }

  private upcomingMaintenance(material: MaterialRow) {
    const now = deriveReferenceNow(this.window);
    const horizonEnd = addMonths(now, 4);
    const rows = this.maintenanceByMaterial.get(material.id) ?? [];
    return rows
      .filter((r) => {
        const planned = new Date(r.planned_date + "T00:00:00Z");
        return planned >= now && planned <= horizonEnd;
      })
      .map((r) => ({
        workOrder: r.work_order,
        plannedDate: r.planned_date,
        requiredQty: r.required_qty,
        maintenanceType: r.maintenance_type,
      }));
  }

  private buildNotStockManaged(material: MaterialRow): Recommendation {
    return {
      materialId: material.id,
      materialCode: material.material_code,
      description: material.description,
      materialGroup: material.material_group,
      circuit: material.circuit ?? null,
      criticality: material.criticality,
      plant: material.plant,
      demandClass: "NotStockManaged",
      confidence: "NotApplicable",
      isOAR: false,
      notStockManaged: true,
      current: {
        currentSafetyStock: 0,
        currentROP: 0,
        currentMaxStock: 0,
        recommendedSafetyStock: 0,
        recommendedROP: 0,
        recommendedMaxStockOptionA: 0,
        recommendedMaxStockOptionB: 0,
      },
      riskBefore: "NotApplicable",
      riskAfter: "NotApplicable",
      zFactor: null,
      zFactorIsIllustrative: false,
      policyStatus: null,
      trace: [
        {
          step: "0",
          label: "Not stock-managed",
          note: "This is a contracted service line (material_group = Services), not a physical spare -- it carries no consumption_history/goods_receipt/current_inventory rows and is out of scope for SS/ROP/Max recommendations.",
        },
      ],
      reasons: ["Service line item -- not inventory-managed, no recommendation applies."],
      flags: [],
      upcomingMaintenance: [],
      oarNeighbors: [],
    };
  }

  private build(material: MaterialRow): Recommendation {
    const consumption = this.consumptionByMaterial.get(material.id) ?? [];
    const goodsReceipt = this.goodsReceiptByMaterial.get(material.id) ?? [];
    const classification = classifyMaterial(this.window.length, consumption, material.oar_flag);

    const trace: TraceStep[] = [
      {
        step: "1",
        label: "History gate",
        formula: "route to OAR if oar_flag, or non-zero months < 5, or window < 6 months",
        inputs: {
          oar_flag: String(material.oar_flag),
          non_zero_months: String(classification.nNonZero),
          window_months: String(classification.n),
        },
        result: classification.routedToOAR ? "Routed to OAR/cold-start path" : "Passed -- proceeding to ADI/CV² classification",
        note: classification.gateReason ?? undefined,
      },
    ];

    if (classification.routedToOAR) {
      return this.buildOarPath(material, classification, trace);
    }

    trace.push({
      step: "1",
      label: "ADI / CV² classification",
      formula: "ADI = n / n_nz;  CV² = (σ_nz / μ_nz)²",
      inputs: {
        n: String(classification.n),
        n_nz: String(classification.nNonZero),
        mu_nz: classification.muNz.toFixed(2),
        sigma_nz: classification.sigmaNz.toFixed(2),
      },
      result: `ADI=${classification.adi.toFixed(2)}, CV²=${classification.cv2.toFixed(2)} -> ${classification.demandClass}`,
    });

    const isSmoothOrErratic = classification.demandClass === "Smooth" || classification.demandClass === "Erratic";

    let demandRatePerMonth: number;
    let dAvg = 0;
    let sigmaD = 0;
    let sbaPFinal: number | null = null;
    let sbaZFinal: number | null = null;

    if (isSmoothOrErratic) {
      const forecast = forecastStatistical(this.window, consumption);
      dAvg = forecast.dAvg;
      sigmaD = forecast.sigmaD;
      demandRatePerMonth = dAvg;
      trace.push({
        step: "2",
        label: "Demand forecast (Statistical)",
        formula: "D_avg, σ_D over all 24 months (zero months included)",
        inputs: {},
        result: `D_avg=${dAvg.toFixed(2)}/mo, σ_D=${sigmaD.toFixed(2)}`,
      });
    } else {
      const sba = forecastSBA(this.window, consumption, SBA_ALPHA);
      sbaPFinal = sba.pFinal;
      sbaZFinal = sba.zFinal;
      demandRatePerMonth = sba.forecastPerMonth ?? 0;
      trace.push({
        step: "2",
        label: "Demand forecast (SBA)",
        formula: "forecast = (1 - α/2) × z_final / p_final,  α = 0.10",
        inputs: {
          p_final_months: sbaPFinal?.toFixed(2) ?? "n/a",
          z_final_units: sbaZFinal?.toFixed(2) ?? "n/a",
        },
        result: `${demandRatePerMonth.toFixed(2)} units/mo`,
        note: "Recommendation method: Predictive model (LightGBM) -- not yet trained, SBA baseline shown.",
      });
    }

    const leadTime = computeLeadTime(material, goodsReceipt);
    trace.push({
      step: "3",
      label: "Lead-time analysis",
      formula: leadTime.usedFallback
        ? "fallback: materials.lead_time_days (planned only, no goods_receipt records)"
        : "LT_avg, σ_LT = mean/stdev of (goods_receipt_date - po_creation_date) in months",
      inputs: { goods_receipt_records: String(leadTime.recordCount) },
      result: `LT_avg=${leadTime.ltAvgMonths.toFixed(2)} mo, σ_LT=${leadTime.sigmaLtMonths.toFixed(2)} mo`,
      note: leadTime.usedFallback ? "Confidence forced to LOW -- fewer than 2 goods-receipt records." : undefined,
    });

    const serviceLevel = resolveServiceLevel(material.criticality, material.circuit, this.data.criticalityPolicy);
    trace.push({
      step: "4",
      label: "Service level (Z-factor)",
      formula: "lookup criticality_policy.csv by criticality x circuit",
      inputs: { criticality: material.criticality, circuit: material.circuit },
      result: `Z=${serviceLevel.z.toFixed(2)} (ILLUSTRATIVE, pending sign-off)`,
      note: `Policy status: ${serviceLevel.policyRow?.status ?? "not found"} -- no approved service-level target/Z-factor exists yet.`,
    });

    let safetyStock: number;
    let expectedLTD: number;

    if (isSmoothOrErratic) {
      expectedLTD = dAvg * leadTime.ltAvgMonths;
      const variance = leadTime.ltAvgMonths * sigmaD ** 2 + dAvg ** 2 * leadTime.sigmaLtMonths ** 2;
      safetyStock = serviceLevel.z * Math.sqrt(Math.max(0, variance));
      trace.push({
        step: "5",
        label: "Safety stock (Smooth/Erratic)",
        formula: "SS = Z × √(LT_avg × σ_D² + D_avg² × σ_LT²)",
        inputs: {
          Z: serviceLevel.z.toFixed(2),
          LT_avg: leadTime.ltAvgMonths.toFixed(2),
          sigma_D: sigmaD.toFixed(2),
          D_avg: dAvg.toFixed(2),
          sigma_LT: leadTime.sigmaLtMonths.toFixed(2),
        },
        result: `SS=${roundUp(safetyStock)} units`,
      });
    } else {
      const pFinal = sbaPFinal && sbaPFinal > 0 ? sbaPFinal : 1;
      const lambda = leadTime.ltAvgMonths / pFinal;
      const varLTD = lambda * (classification.sigmaNz ** 2 + classification.muNz ** 2);
      safetyStock = serviceLevel.z * Math.sqrt(Math.max(0, varLTD));
      expectedLTD = demandRatePerMonth * leadTime.ltAvgMonths;
      trace.push({
        step: "5",
        label: "Safety stock (Intermittent/Lumpy, compound-Poisson)",
        formula: "λ = LT_avg / p_final;  Var[LTD] = λ × (σ_nz² + μ_nz²);  SS = Z × √Var[LTD]",
        inputs: {
          lambda: lambda.toFixed(3),
          sigma_nz: classification.sigmaNz.toFixed(2),
          mu_nz: classification.muNz.toFixed(2),
          Z: serviceLevel.z.toFixed(2),
        },
        result: `SS=${roundUp(safetyStock)} units`,
      });
    }

    const rop = expectedLTD + safetyStock;
    trace.push({
      step: "5",
      label: "Reorder point",
      formula: "ROP = E[LTD] + SS",
      inputs: { E_LTD: expectedLTD.toFixed(2), SS: safetyStock.toFixed(2) },
      result: `ROP=${roundUp(rop)} units`,
    });

    const dAnnual = demandRatePerMonth * 12;
    const price = material.last_po_price;
    const eoq =
      price > 0 ? Math.sqrt((2 * dAnnual * DEFAULT_ORDERING_COST) / (DEFAULT_HOLDING_RATE * price)) : 0;
    const maxOptionA = safetyStock + eoq;
    const reviewMonths = REVIEW_PERIOD_MONTHS[material.criticality];
    const maxOptionB = rop + demandRatePerMonth * reviewMonths;
    trace.push({
      step: "5",
      label: "Max stock (Option A: EOQ)",
      formula: "EOQ = √(2 × D_annual × S / (H × P));  Max = SS + EOQ",
      inputs: {
        D_annual: dAnnual.toFixed(1),
        S: String(DEFAULT_ORDERING_COST),
        H: String(DEFAULT_HOLDING_RATE),
        P: price.toFixed(2),
      },
      result: `EOQ=${roundUp(eoq)}, Max=${roundUp(maxOptionA)} units`,
    });
    trace.push({
      step: "5",
      label: `Max stock (Option B: review period, T=${reviewMonths}mo for ${material.criticality})`,
      formula: "Max = ROP + (D_avg × T)",
      inputs: { ROP: roundUp(rop).toString(), demand_rate_per_month: demandRatePerMonth.toFixed(2), T_months: String(reviewMonths) },
      result: `Max=${roundUp(maxOptionB)} units`,
    });

    const confidence = statisticalConfidence(classification.nNonZero, leadTime.recordCount, leadTime.usedFallback);
    trace.push({
      step: "7",
      label: "Confidence grade",
      formula: "worse-of( history-depth grade, goods-receipt-count grade ); LOW forced if lead-time fallback used",
      inputs: { non_zero_months: String(classification.nNonZero), goods_receipt_records: String(leadTime.recordCount) },
      result: confidence,
    });

    const recommendedROP = roundUp(rop);
    const riskBefore = riskFromRopRatio(material.current_rop, recommendedROP);

    const reasons = this.buildStatisticalReasons(material, classification, leadTime, confidence, recommendedROP);
    const flags: string[] = [];
    if (leadTime.usedFallback) flags.push("Lead-time fallback used (fewer than 2 goods-receipt records)");
    if (classification.nNonZero < 12) flags.push("Limited consumption history (<12 months of non-zero data)");

    return {
      materialId: material.id,
      materialCode: material.material_code,
      description: material.description,
      materialGroup: material.material_group,
      circuit: material.circuit,
      criticality: material.criticality,
      plant: material.plant,
      demandClass: classification.demandClass as DemandClass,
      confidence,
      isOAR: false,
      notStockManaged: false,
      current: {
        currentSafetyStock: material.current_safety_stock,
        currentROP: material.current_rop,
        currentMaxStock: material.current_max_stock,
        recommendedSafetyStock: roundUp(safetyStock),
        recommendedROP,
        recommendedMaxStockOptionA: roundUp(maxOptionA),
        recommendedMaxStockOptionB: roundUp(maxOptionB),
      },
      riskBefore,
      // Adopting the recommendation puts current ROP exactly at the recommended ROP by
      // definition, so post-adoption risk is always Low -- shown for symmetry with riskBefore.
      riskAfter: "Low",
      zFactor: serviceLevel.z,
      zFactorIsIllustrative: serviceLevel.isIllustrative,
      policyStatus: serviceLevel.policyRow?.status ?? null,
      trace,
      reasons,
      flags,
      upcomingMaintenance: this.upcomingMaintenance(material),
      oarNeighbors: [],
    };
  }

  /** Plain-language, business-facing descriptions of each demand class -- the exact
   * ADI/CV² math behind the classification still lives in the "Technical details" trace
   * table for anyone who wants it; this prose is written for a non-technical reader. */
  private static readonly DEMAND_PLAIN_LANGUAGE: Record<string, string> = {
    Smooth: "it's used steadily and predictably, month to month",
    Erratic: "it's needed every month, but the quantity ordered swings a lot from one order to the next",
    Intermittent: "it's only needed occasionally, with quiet stretches between orders, though the order size itself is fairly steady",
    Lumpy: "it's only needed occasionally, and both the timing and the order size are hard to predict",
  };

  private buildStatisticalReasons(
    material: MaterialRow,
    classification: ReturnType<typeof classifyMaterial>,
    leadTime: ReturnType<typeof computeLeadTime>,
    confidence: ConfidenceGrade,
    recommendedROP: number,
  ): string[] {
    const reasons: string[] = [];

    const demandPlain =
      RecommendationEngine.DEMAND_PLAIN_LANGUAGE[classification.demandClass] ?? "its usage pattern doesn't fit a simple, steady trend";
    reasons.push(`Based on ${classification.nNonZero} months of actual usage, ${demandPlain}.`);

    if (leadTime.usedFallback) {
      reasons.push(
        `There isn't enough delivery history yet to measure real supplier lead time, so this uses the planned lead time from the item's master data: ${material.lead_time_days} days.`,
      );
    } else {
      const cv = leadTime.ltAvgMonths > 0 ? leadTime.sigmaLtMonths / leadTime.ltAvgMonths : 0;
      const consistency = cv < 0.2 ? "delivery timing has been fairly consistent" : "delivery timing has varied noticeably order to order";
      reasons.push(
        `Suppliers have taken about ${leadTime.ltAvgMonths.toFixed(1)} months on average to deliver this item, based on the last ${leadTime.recordCount} completed orders, and ${consistency}.`,
      );
    }

    if (material.current_rop === 0) {
      reasons.push(
        `There's no reorder trigger point set for this item yet -- ${recommendedROP} units would be the first data-driven level, based on how it's used and how long it takes to restock.`,
      );
    } else if (recommendedROP > material.current_rop) {
      const pct = Math.round(((recommendedROP - material.current_rop) / material.current_rop) * 100);
      reasons.push(
        `Stock is currently reordered at ${material.current_rop} units, but usage and delivery timing say this item needs ${recommendedROP} units in reserve (about ${pct}% higher) to avoid running out before the next delivery arrives.`,
      );
    } else if (recommendedROP < material.current_rop) {
      reasons.push(
        `The current reorder point (${material.current_rop} units) is higher than what the data supports -- ${recommendedROP} units would cover the same need, so this item may be tying up more stock than necessary.`,
      );
    } else {
      reasons.push(`The current reorder point (${material.current_rop} units) already matches what the data supports for this item.`);
    }

    if (confidence === "LOW") {
      reasons.push("There isn't a lot of data behind this one yet -- treat it as a starting point to sanity-check, not a final number.");
    }
    return reasons;
  }

  private buildOarPath(
    material: MaterialRow,
    classification: ReturnType<typeof classifyMaterial>,
    trace: TraceStep[],
  ): Recommendation {
    const physicalNonOar = this.data.materials.filter((m) => m.material_group !== "Services" && !m.oar_flag);
    const neighbors = findOarNeighbors(material, physicalNonOar);

    trace.push({
      step: "6",
      label: "OAR similarity search",
      formula: "similarity = 0.5 × structural (Gower-style) + 0.5 × text (word-overlap Jaccard); criticality is a hard filter",
      inputs: { candidate_pool: String(physicalNonOar.length), neighbors_found: String(neighbors.length) },
      result: neighbors.length
        ? `Top match: ${neighbors[0].material.material_code} (similarity=${(neighbors[0].combinedSimilarity * 100).toFixed(0)}%)`
        : "No comparable materials found",
    });

    if (neighbors.length === 0) {
      return {
        materialId: material.id,
        materialCode: material.material_code,
        description: material.description,
        materialGroup: material.material_group,
        circuit: material.circuit,
        criticality: material.criticality,
        plant: material.plant,
        demandClass: "OAR",
        confidence: "LOW",
        isOAR: true,
        notStockManaged: false,
        current: {
          currentSafetyStock: material.current_safety_stock,
          currentROP: material.current_rop,
          currentMaxStock: material.current_max_stock,
          recommendedSafetyStock: 0,
          recommendedROP: 0,
          recommendedMaxStockOptionA: 0,
          recommendedMaxStockOptionB: 0,
        },
        riskBefore: "Critical",
        riskAfter: "Critical",
        zFactor: null,
        zFactorIsIllustrative: false,
        policyStatus: null,
        trace,
        reasons: ["No comparable materials found (same criticality pool is empty) -- manual review required."],
        flags: ["OAR / cold-start: no neighbors available"],
        upcomingMaintenance: this.upcomingMaintenance(material),
        oarNeighbors: [],
      };
    }

    const neighborRecs = neighbors.map((n) => ({
      neighbor: n,
      rec: this.getRecommendation(n.material.id),
    }));

    const totalWeight = neighborRecs.reduce((sum, n) => sum + n.neighbor.combinedSimilarity, 0) || 1;
    const weightedAvg = (pick: (r: Recommendation) => number) =>
      neighborRecs.reduce((sum, n) => sum + pick(n.rec) * n.neighbor.combinedSimilarity, 0) / totalWeight;

    const recommendedSS = weightedAvg((r) => r.current.recommendedSafetyStock);
    const recommendedROP = weightedAvg((r) => r.current.recommendedROP);
    const recommendedMaxA = weightedAvg((r) => r.current.recommendedMaxStockOptionA);
    const recommendedMaxB = weightedAvg((r) => r.current.recommendedMaxStockOptionB);

    trace.push({
      step: "6",
      label: "OAR recommendation",
      formula: "similarity-weighted average of top-5 neighbors' own SS/ROP/Max",
      inputs: { neighbors_used: String(neighborRecs.length) },
      result: `SS=${roundUp(recommendedSS)}, ROP=${roundUp(recommendedROP)}, Max(A)=${roundUp(recommendedMaxA)}, Max(B)=${roundUp(recommendedMaxB)}`,
    });

    const confidence = oarConfidence(neighbors);
    const recommendedROPRounded = roundUp(recommendedROP);
    const riskBefore = riskFromRopRatio(material.current_rop, recommendedROPRounded);

    return {
      materialId: material.id,
      materialCode: material.material_code,
      description: material.description,
      materialGroup: material.material_group,
      circuit: material.circuit,
      criticality: material.criticality,
      plant: material.plant,
      demandClass: "OAR",
      confidence,
      isOAR: true,
      notStockManaged: false,
      current: {
        currentSafetyStock: material.current_safety_stock,
        currentROP: material.current_rop,
        currentMaxStock: material.current_max_stock,
        recommendedSafetyStock: roundUp(recommendedSS),
        recommendedROP: recommendedROPRounded,
        recommendedMaxStockOptionA: roundUp(recommendedMaxA),
        recommendedMaxStockOptionB: roundUp(recommendedMaxB),
      },
      riskBefore,
      riskAfter: "Low",
      zFactor: null,
      zFactorIsIllustrative: false,
      policyStatus: null,
      trace,
      reasons: [
        `${classification.gateReason ?? "Insufficient consumption history"} -- routed to the OAR/cold-start similarity path.`,
        `Recommendation derived from ${neighborRecs.length} comparable material(s) (best match: ${neighbors[0].material.description}, ${(neighbors[0].combinedSimilarity * 100).toFixed(0)}% similarity).`,
        confidence === "LOW" ? "Low neighbor similarity -- treat this recommendation as a rough starting point only." : "Neighbor similarity supports a reasonable starting estimate.",
      ],
      flags: ["OAR / cold-start material -- no reliable consumption history"],
      upcomingMaintenance: this.upcomingMaintenance(material),
      oarNeighbors: neighborRecs.map((n) => ({
        materialId: n.neighbor.material.id,
        materialCode: n.neighbor.material.material_code,
        description: n.neighbor.material.description,
        combinedSimilarity: n.neighbor.combinedSimilarity,
      })),
    };
  }
}
