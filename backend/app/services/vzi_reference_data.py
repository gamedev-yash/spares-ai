""""VZI Open PR & PO Position" reference dashboard data.

These figures were transcribed VERBATIM from a real VZI review-slides workbook (previously
hardcoded in src/lib/mock-data.ts, then moved into Postgres via the old
scripts/import_vzi_reference.py). They are real business reference data, not synthetic --
do not regenerate or "correct" them. The live synthetic Initiative-9 dataset and its
/api/analytics/* + /api/cycle-time endpoints are a separate lane fed by process_stage_events.csv.

Kept as plain Python constants (not a CSV) because this is a small, fixed, non-regenerated
reference dataset -- the CSV files under backend/data/ are reserved for the synthetic
procurement lifecycle data this project actually generates and mutates.
"""

from __future__ import annotations

PR_SUMMARY = [
    {"unit": "Gamsberg", "material": 307, "service": 39},
    {"unit": "BMM", "material": 202, "service": 71},
]

AGING = [
    {"bucket": "0-7 days", "count": 49},
    {"bucket": "7-15 days", "count": 56},
    {"bucket": "15-30 days", "count": 96},
    {"bucket": "30-60 days", "count": 150},
    {"bucket": "60-90 days", "count": 85},
    {"bucket": "90-120 days", "count": 90},
    {"bucket": "More than 120 days", "count": 93},
]

OAR_VB = [
    {"unit": "Gamsberg", "area": "Plant", "oar": 122, "vb": 167},
    {"unit": "Gamsberg", "area": "Mining", "oar": 0, "vb": 0},
    {"unit": "Gamsberg", "area": "Other", "oar": 7, "vb": 0},
    {"unit": "BMM", "area": "Plant", "oar": 135, "vb": 67},
    {"unit": "BMM", "area": "Mining", "oar": 0, "vb": 0},
    {"unit": "BMM", "area": "Other", "oar": 11, "vb": 0},
]

CATEGORIES = [
    {"unit": "BMM", "area": "Plant", "category": "Repair", "count": 76},
    {"unit": "BMM", "area": "Plant", "category": "General Consumables", "count": 63},
    {"unit": "BMM", "area": "Plant", "category": "Dewatering", "count": 55},
    {"unit": "BMM", "area": "Plant", "category": "Filtration", "count": 5},
    {"unit": "BMM", "area": "Plant", "category": "Reagent", "count": 3},
    {"unit": "BMM", "area": "Other", "category": "Township (OAR)", "count": 11},
    {"unit": "Gamsberg", "area": "Plant", "category": "Repair", "count": 99},
    {"unit": "Gamsberg", "area": "Plant", "category": "Filtration", "count": 55},
    {"unit": "Gamsberg", "area": "Plant", "category": "General Consumables", "count": 44},
    {"unit": "Gamsberg", "area": "Plant", "category": "Milling", "count": 38},
    {"unit": "Gamsberg", "area": "Plant", "category": "Crushing", "count": 20},
    {"unit": "Gamsberg", "area": "Plant", "category": "Dewatering", "count": 16},
    {"unit": "Gamsberg", "area": "Plant", "category": "Electrical Spares", "count": 11},
    {"unit": "Gamsberg", "area": "Plant", "category": "Phase-2", "count": 5},
    {"unit": "Gamsberg", "area": "Plant", "category": "Reagent", "count": 1},
    {"unit": "Gamsberg", "area": "Other", "category": "General Consumables", "count": 7},
]

PO_SUMMARY = [
    {"unit": "Gamsberg", "material": 115, "service": 142},
    {"unit": "BMM", "material": 77, "service": 145},
]

PO_DETAIL = [
    {"unit": "Gamsberg", "area": "Plant", "matCount": 106, "matValue": 147.02, "svcCount": 73, "svcValue": 378.8},
    {"unit": "Gamsberg", "area": "Plant Ph2", "matCount": 2, "matValue": 0.01, "svcCount": 1, "svcValue": 21.18},
    {"unit": "Gamsberg", "area": "Mining", "matCount": 6, "matValue": 150.04, "svcCount": 38, "svcValue": 1501.0},
    {"unit": "Gamsberg", "area": "Other", "matCount": 1, "matValue": 0.01, "svcCount": 30, "svcValue": 254.42},
    {"unit": "BMM", "area": "Plant", "matCount": 57, "matValue": 20.9, "svcCount": 30, "svcValue": 184.82},
    {"unit": "BMM", "area": "Mining", "matCount": 5, "matValue": 7.58, "svcCount": 20, "svcValue": 1037.29},
    {"unit": "BMM", "area": "Swartberg", "matCount": 0, "matValue": 0.0, "svcCount": 2, "svcValue": 5.06},
    {"unit": "BMM", "area": "Other", "matCount": 15, "matValue": 0.33, "svcCount": 93, "svcValue": 0.0},
]

SLIDE_NOTES = [
    "Of the 509 open material PRs, 275 were triggered automatically from Min-Max levels; these Min-Max settings are to be reviewed to avoid duplicate / unnecessary PRs.",
    "Of the 509 open material PRs, 234 are OAR items requiring critical review.",
    "Of the 479 open POs, 192 are material POs and 287 are service POs.",
    "11 mining material and 58 mining service POs relate to care-and-maintenance items.",
    "'Other' consists of enabling-function services (finance, safety, admin, etc.).",
]

DERIVED_NOTES = [
    "PRs older than 30 days: 418 of 619 (67.5%); older than 90 days: 183 (29.6%).",
    "Service POs carry 91.2% of open PO value (ZAR 3 382.57 Mn of 3 708.46 Mn).",
    "Mining areas account for 72.7% of open PO value (ZAR 2 695.91 Mn across Gamsberg and BMM mining).",
    "Care-and-maintenance items: 69 POs (11 material + 58 service).",
]

CARE_MAINTENANCE = {"material": 11, "service": 58, "total": 69}

FLAGS = [
    {
        "title": "OAR vs VB labels",
        "body": "the table shows OAR = 275 and VB = 234, while the narrative bullets attribute 275 to Min-Max (auto) triggers and 234 to OAR. The two counts appear swapped between table and text; worth confirming which label maps to which trigger type before publishing.",
    },
    {
        "title": "Unit split of material PRs",
        "body": "the unit summary shows Gamsberg 307 / BMM 202, while the OAR-VB table shows Gamsberg 296 / BMM 213. Both total 509; the difference of 11 each way equals the 11 Township PRs under BMM 'Other', suggesting a classification difference between the two views.",
    },
    {
        "title": "BMM 'Other' service PO value",
        "body": "blank on the slide; it back-calculates to 0.00 from the BMM subtotal and is entered as such.",
    },
]
