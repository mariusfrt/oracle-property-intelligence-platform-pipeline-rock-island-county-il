"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { SearchParcelsFilters } from "@oracle/shared";

export interface FilterPanelProps {
  filters: SearchParcelsFilters;
  onChange: (filters: SearchParcelsFilters) => void;
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
  onSearch,
  searching,
  className = "",
  onClose,
}: FilterPanelProps) {
  const [signalsOpen, setSignalsOpen] = useState(false);
  const selectedSignals = CHECKBOX_FILTERS.filter(([key]) => Boolean(filters[key]));

  return (
    <aside className={`card flex min-h-0 flex-col overflow-hidden p-0 ${className}`}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        {onClose ? (
          <button type="button" onClick={onClose} className="btn-secondary shrink-0 text-xs">
            Close
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="min-acres" className="label-caps mb-0.5 block">
              Min acres
            </label>
            <input
              id="min-acres"
              type="number"
              min={0}
              value={filters.minAcres ?? ""}
              onChange={(e) =>
                onChange({ ...filters, minAcres: e.target.value ? Number(e.target.value) : undefined })
              }
              className="input-base h-8 text-sm"
              placeholder="0"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="max-acres" className="label-caps mb-0.5 block">
              Max acres
            </label>
            <input
              id="max-acres"
              type="number"
              min={0}
              value={filters.maxAcres ?? ""}
              onChange={(e) =>
                onChange({ ...filters, maxAcres: e.target.value ? Number(e.target.value) : undefined })
              }
              className="input-base h-8 text-sm"
              placeholder="Any"
            />
          </div>
        </div>

        <div>
          <label htmlFor="free-text" className="label-caps mb-0.5 block">
            Owner / address
          </label>
          <input
            id="free-text"
            type="search"
            value={filters.query ?? ""}
            onChange={(e) => onChange({ ...filters, query: e.target.value || undefined })}
            className="input-base h-8 text-sm"
            placeholder="Search text…"
          />
        </div>

        <fieldset>
          <button
            type="button"
            onClick={() => setSignalsOpen((v) => !v)}
            aria-expanded={signalsOpen}
            className="flex w-full items-center justify-between gap-2 rounded py-0.5 text-left focus-ring"
          >
            <span className="label-caps flex items-center gap-1.5">
              Signals
              {selectedSignals.length > 0 ? (
                <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] font-semibold tabular-nums text-indigo-700">
                  {selectedSignals.length}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${signalsOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>

          {signalsOpen ? (
            <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
              {CHECKBOX_FILTERS.map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-1.5 rounded py-0.5 text-xs leading-tight text-slate-700 hover:text-slate-900"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(filters[key])}
                    onChange={(e) => onChange({ ...filters, [key]: e.target.checked || undefined })}
                    className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-indigo-600 focus-ring"
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : selectedSignals.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {selectedSignals.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ ...filters, [key]: undefined })}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-2 pr-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 focus-ring"
                  title={`Remove ${label}`}
                >
                  {label}
                  <X className="h-3 w-3" aria-hidden />
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-400">No signals selected</p>
          )}
        </fieldset>
      </div>

      <div className="shrink-0 border-t border-slate-200 px-3 py-2.5">
        <button
          type="button"
          onClick={onSearch}
          disabled={searching}
          className="btn-primary h-9 w-full text-sm"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
    </aside>
  );
}
