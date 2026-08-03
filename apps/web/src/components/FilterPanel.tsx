"use client";

import type { SearchParcelsFilters } from "@oracle/shared";
import { PRESET_LABELS, type PresetQueryKind } from "@oracle/shared";

export interface FilterPanelProps {
  filters: SearchParcelsFilters;
  onChange: (filters: SearchParcelsFilters) => void;
  onPreset?: (preset: PresetQueryKind) => void;
  onSearch?: () => void;
  searching?: boolean;
  className?: string;
  /** Optional close control for mobile sheet usage. */
  onClose?: () => void;
}

const CHECKBOX_FILTERS = [
  ["industrial", "Industrial zoning"],
  ["stableOwnership", "Stable ownership (>10y)"],
  ["ownerOutOfArea", "Out-of-area owner"],
  ["nearPower", "Near power"],
  ["nearWater", "Near water"],
  ["nearTransit", "Near transit"],
  ["nearStarbucks", "Near Starbucks"],
] as const;

export function FilterPanel({
  filters,
  onChange,
  onPreset,
  onSearch,
  searching,
  className = "",
  onClose,
}: FilterPanelProps) {
  return (
    <aside className={`card flex min-h-0 flex-col gap-0 overflow-hidden p-0 ${className}`}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
          <p className="mt-0.5 text-xs text-slate-500">Refine parcel search criteria</p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="btn-secondary shrink-0 text-xs">
            Close
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
        <fieldset className="space-y-3">
          <legend className="label-caps">Acreage</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="min-acres" className="text-xs text-slate-600">
                Min
              </label>
              <input
                id="min-acres"
                type="number"
                min={0}
                value={filters.minAcres ?? ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    minAcres: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="input-base"
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="max-acres" className="text-xs text-slate-600">
                Max
              </label>
              <input
                id="max-acres"
                type="number"
                min={0}
                value={filters.maxAcres ?? ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    maxAcres: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="input-base"
                placeholder="∞"
              />
            </div>
          </div>
        </fieldset>

        <div>
          <label htmlFor="free-text" className="label-caps block">
            Owner / address
          </label>
          <input
            id="free-text"
            type="search"
            value={filters.query ?? ""}
            onChange={(e) => onChange({ ...filters, query: e.target.value || undefined })}
            className="input-base"
            placeholder="Search text…"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="label-caps mb-1">Signals</legend>
          {CHECKBOX_FILTERS.map(([key, label]) => (
            <label
              key={key}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md py-1 text-sm text-slate-700 hover:text-slate-900"
            >
              <input
                type="checkbox"
                checked={Boolean(filters[key])}
                onChange={(e) => onChange({ ...filters, [key]: e.target.checked || undefined })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus-ring"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="border-t border-slate-200 pt-4">
          <p className="label-caps mb-3">Question presets</p>
          <div className="flex flex-col gap-2">
            {(Object.keys(PRESET_LABELS) as PresetQueryKind[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onPreset?.(preset)}
                disabled={searching}
                className="btn-secondary w-full justify-start text-left text-xs leading-snug"
              >
                {PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 p-4">
        <button type="button" onClick={onSearch} disabled={searching} className="btn-primary w-full">
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
    </aside>
  );
}
