import type { PlantReference } from "@/lib/domain/contracts"

// No plant/site catalog existed before this — the only prior concept was the
// literal union `VziUnit = "Gamsberg" | "BMM"` scattered through the VZI
// dashboard types. This is the new stable plant ID source every initiative
// should use instead of inventing its own site names.
//
// A third site (Skorpion Zinc) is included beyond the two VZI units so
// Initiative 13's cross-site redeployment scenario has somewhere to find
// unused stock.

export interface Plant extends PlantReference {
  /** matches the existing VziUnit literal where one exists, for VZI dashboard interop */
  vziUnit?: "Gamsberg" | "BMM"
  region: string
}

export const PLANTS: Plant[] = [
  {
    plantId: "PLANT-GBG",
    name: "Gamsberg",
    vziUnit: "Gamsberg",
    region: "Northern Cape, South Africa",
  },
  {
    plantId: "PLANT-BMM",
    name: "Black Mountain Mining",
    vziUnit: "BMM",
    region: "Northern Cape, South Africa",
  },
  {
    plantId: "PLANT-SKZ",
    name: "Skorpion Zinc",
    region: "Karas, Namibia",
  },
]

export function getPlantById(plantId: string): Plant | undefined {
  return PLANTS.find((p) => p.plantId === plantId)
}
