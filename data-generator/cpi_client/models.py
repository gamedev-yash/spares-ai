"""
The SAP side of the contract, as data.

Two things callers should not have to know:

  * which of the two services owns a given entity set;
  * what EDM type each property is declared as.

Both are already recorded by cpi_discovery.py in discovery/properties.csv,
so this module reads that file rather than restating it. A fresh discovery
run therefore updates the client with no code change - the same design
generate.py uses.

If the discovery folder is absent, a hard-coded fallback keeps the client
usable: the entity-set-to-service split is stable, only the property lists
move.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

from .errors import CPINotFoundError

DEFAULT_DISCOVERY_DIR = Path(__file__).resolve().parent.parent / "discovery"

# Fallback set-to-service map, used only when discovery/properties.csv is
# missing. Mirrors cpi_discovery.py's SERVICES.
FALLBACK_SERVICES: dict[str, tuple[str, ...]] = {
    "ZVZI_KPI02_SHARED_SRV": (
        "GoodsMovementItemSet", "InfoRecordOrgSet", "InfoRecordSet",
        "MaterialDescriptionSet", "MaterialDocumentHeaderSet", "MaterialPlantSet",
        "MaterialSet", "POHistorySet", "POScheduleLineSet", "PurchaseOrderItemSet",
        "PurchaseOrderSet", "PurchaseRequisitionSet", "StorageLocationStockSet",
        "VendorSet",
    ),
    "ZMM_KPI02_SRV": (
        "BatchStockSet", "ChangeDocHeaderSet", "ChangeDocItemSet",
        "MaterialValuationSet", "MonthlyMovementStatisticSet", "ReservationItemSet",
        "StockMovementStatisticSet",
    ),
}


@dataclass
class EntitySetInfo:
    name: str
    service: str
    properties: dict[str, str] = field(default_factory=dict)  # name -> EDM type
    keys: list[str] = field(default_factory=list)

    @property
    def property_names(self) -> list[str]:
        return list(self.properties)


class Schema:
    """Entity-set registry: which service owns it, and its property types."""

    def __init__(self, sets: dict[str, EntitySetInfo], source: Path | None) -> None:
        self._sets = sets
        self.source = source

    @classmethod
    def load(cls, discovery_dir: str | Path | None = None) -> "Schema":
        directory = Path(discovery_dir) if discovery_dir else DEFAULT_DISCOVERY_DIR
        path = directory / "properties.csv"
        if not path.is_file():
            return cls._fallback()

        sets: dict[str, EntitySetInfo] = {}
        with path.open(newline="", encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle):
                name = (row.get("entity_set") or "").strip()
                if not name:
                    continue
                info = sets.setdefault(
                    name, EntitySetInfo(name=name, service=(row.get("service") or "").strip())
                )
                prop = (row.get("property") or "").strip()
                if prop:
                    info.properties[prop] = (row.get("type") or "").strip()
                    if (row.get("is_key") or "").strip().upper() == "K":
                        info.keys.append(prop)
        if not sets:
            return cls._fallback()
        return cls(sets, path)

    @classmethod
    def _fallback(cls) -> "Schema":
        sets = {
            name: EntitySetInfo(name=name, service=service)
            for service, names in FALLBACK_SERVICES.items()
            for name in names
        }
        return cls(sets, None)

    def __contains__(self, entity_set: str) -> bool:
        return entity_set in self._sets

    def __iter__(self):
        return iter(sorted(self._sets))

    def get(self, entity_set: str) -> EntitySetInfo:
        try:
            return self._sets[entity_set]
        except KeyError:
            near = [n for n in self._sets if n.lower().startswith(entity_set.lower()[:6])]
            hint = f" Did you mean: {', '.join(sorted(near))}?" if near else ""
            raise CPINotFoundError(
                f"unknown entity set {entity_set!r}. "
                f"{len(self._sets)} known.{hint}"
            ) from None

    def service_for(self, entity_set: str) -> str:
        return self.get(entity_set).service

    def types_for(self, entity_set: str) -> dict[str, str]:
        """Property -> EDM type, or {} when discovery has not seen the set."""
        try:
            return dict(self.get(entity_set).properties)
        except CPINotFoundError:
            return {}

    @property
    def services(self) -> dict[str, list[str]]:
        grouped: dict[str, list[str]] = {}
        for name in sorted(self._sets):
            grouped.setdefault(self._sets[name].service, []).append(name)
        return grouped


@dataclass
class Page:
    """One page of an entity collection.

    ``next_path``/``next_query`` are already re-split into the APIPath and
    APIQuery form the proxy needs, so following a page is the same kind of
    call as making the first one.
    """

    rows: list[dict]
    next_path: str | None = None
    next_query: str | None = None
    total: int | None = None       # from $inlinecount, when requested
    raw: dict | None = None

    @property
    def has_next(self) -> bool:
        return bool(self.next_path)

    def __len__(self) -> int:
        return len(self.rows)
