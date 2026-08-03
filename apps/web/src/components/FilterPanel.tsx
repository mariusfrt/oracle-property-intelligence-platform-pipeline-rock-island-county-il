"use client";

import type { SearchParcelsFilters } from "@oracle/shared";
import { PRESET_LABELS, type PresetQueryKind } from "@oracle/shared";

export interface FilterPanelProps {
  filters: SearchParcelsFilters;
  onChange: (filters: SearchParcelsFilters) => void;
  onPreset?: (preset: PresetQueryKind) => void;
  onSearch?: () => void;
}

export function FilterPanel({ filters, onChange, onPreset, onSearch }: FilterPanelProps) {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 260 }}>
      <h2>Filters</h2>

      <label>
        Min acres
        <input
          type="number"
          min={0}
          value={filters.minAcres ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              minAcres: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </label>

      <label>
        Max acres
        <input
          type="number"
          min={0}
          value={filters.maxAcres ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              maxAcres: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </label>

      <label>
        Free text (owner / address)
        <input
          type="search"
          value={filters.query ?? ""}
          onChange={(e) => onChange({ ...filters, query: e.target.value || undefined })}
        />
      </label>

      {(
        [
          ["industrial", "Industrial zoning"],
          ["stableOwnership", "Stable ownership (>10y)"],
          ["ownerOutOfArea", "Out-of-area owner"],
          ["nearPower", "Near power"],
          ["nearWater", "Near water"],
          ["nearTransit", "Near transit"],
          ["nearStarbucks", "Near Starbucks"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={Boolean(filters[key])}
            onChange={(e) => onChange({ ...filters, [key]: e.target.checked || undefined })}
          />{" "}
          {label}
        </label>
      ))}

      <button type="button" onClick={onSearch}>
        Search
      </button>

      <hr />

      <h3>Question presets</h3>
      {(Object.keys(PRESET_LABELS) as PresetQueryKind[]).map((preset) => (
        <button key={preset} type="button" onClick={() => onPreset?.(preset)}>
          {PRESET_LABELS[preset]}
        </button>
      ))}
    </aside>
  );
}
