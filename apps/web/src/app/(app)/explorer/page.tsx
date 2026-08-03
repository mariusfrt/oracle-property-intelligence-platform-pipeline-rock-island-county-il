"use client";

import { useCallback, useState } from "react";
import type { PresetQueryKind, SearchParcelsFilters } from "@oracle/shared";
import { ExplorerMap } from "@/components/ExplorerMap";
import { FilterPanel } from "@/components/FilterPanel";
import { ParcelDrawer, type ParcelDetail } from "@/components/ParcelDrawer";
import { ResultsTable } from "@/components/ResultsTable";
import { ViewToggle } from "@/components/ViewToggle";
import { mapParcelRows } from "@/lib/parcel-rows";
import { trpc } from "@/lib/trpc-react";

const PAGE_SIZE = 50;

type QueryMode = "idle" | "search" | "preset";
type MobileView = "list" | "map";

/** Explorer, MapLibre + table + filters + detail drawer. */
export default function ExplorerPage() {
  const [filters, setFilters] = useState<SearchParcelsFilters>({});
  const [page, setPage] = useState(1);
  const [queryMode, setQueryMode] = useState<QueryMode>("idle");
  const [activePreset, setActivePreset] = useState<PresetQueryKind | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("list");

  const searchQuery = trpc.parcels.searchParcels.useQuery(
    { ...filters, page, pageSize: PAGE_SIZE },
    { enabled: queryMode === "search" },
  );

  const presetQuery = trpc.parcels.presetQuery.useQuery(
    { preset: activePreset ?? "near_transit", page, pageSize: PAGE_SIZE },
    { enabled: queryMode === "preset" && activePreset != null },
  );

  const activeQuery = queryMode === "preset" ? presetQuery : searchQuery;
  const rows = mapParcelRows((activeQuery.data?.rows ?? []) as Record<string, unknown>[]);
  const total = activeQuery.data?.total ?? 0;

  const parcelDetailQuery = trpc.parcels.parcel.useQuery(
    { objectid: selectedId ?? 0 },
    { enabled: drawerOpen && selectedId != null },
  );

  const handleSearch = useCallback(() => {
    setQueryMode("search");
    setActivePreset(null);
    setPage(1);
    setFiltersOpen(false);
  }, []);

  const handlePreset = useCallback((preset: PresetQueryKind) => {
    setQueryMode("preset");
    setActivePreset(preset);
    setPage(1);
    setFiltersOpen(false);
  }, []);

  const handleSelect = useCallback((objectid: number) => {
    setSelectedId(objectid);
    setDrawerOpen(true);
  }, []);

  const parcelDetail: ParcelDetail | null = parcelDetailQuery.data?.parcel
    ? (parcelDetailQuery.data.parcel as ParcelDetail)
    : null;

  const emptyMessage =
    queryMode === "idle"
      ? "Set filters and click Search, or choose a question preset."
      : activeQuery.isError
        ? "Unable to load parcels right now. Please try again."
        : "No results match the current filters.";

  const mapParcels = rows.map((r) => ({
    objectid: r.objectid,
    geom_geojson: r.geom_geojson ?? null,
    label: r.pin ?? String(r.objectid),
  }));

  const resultsProps = {
    rows,
    selectedObjectId: selectedId,
    onSelect: handleSelect,
    loading: activeQuery.isFetching && queryMode !== "idle",
    isError: activeQuery.isError && queryMode !== "idle",
    emptyMessage,
    total: queryMode === "idle" ? undefined : total,
    page,
    pageSize: PAGE_SIZE,
    onPageChange: setPage,
  } as const;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden px-3 py-3 sm:px-4 lg:px-6">
      {/* Mobile toolbar */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="btn-secondary text-sm"
          aria-expanded={filtersOpen}
          aria-controls="explorer-filters-sheet"
        >
          Filters
        </button>
        <ViewToggle value={mobileView} onChange={setMobileView} />
      </div>

      {/* Desktop: Filters | Results | Map, Mobile: stacked panes with List/Map toggle */}
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[280px_minmax(320px,400px)_minmax(0,1fr)]">
        {/* Filters, desktop column */}
        <div className="hidden min-h-0 lg:flex lg:flex-col">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            onSearch={handleSearch}
            onPreset={handlePreset}
            searching={activeQuery.isFetching}
            className="h-full"
          />
        </div>

        {/* Results + Map share one mobile slot; side-by-side on lg+ */}
        <div className="relative col-span-full min-h-0 min-w-0 lg:col-span-2 lg:contents">
          <div
            className={`absolute inset-0 min-h-0 min-w-0 ${
              mobileView === "list" ? "z-10" : "invisible pointer-events-none z-0"
            } lg:static lg:visible lg:pointer-events-auto lg:z-auto lg:flex lg:flex-col`}
          >
            <ResultsTable {...resultsProps} className="h-full" />
          </div>

          <div
            className={`absolute inset-0 min-h-0 min-w-0 ${
              mobileView === "map" ? "z-10" : "invisible pointer-events-none z-0"
            } lg:static lg:visible lg:pointer-events-auto lg:z-auto lg:flex lg:flex-col`}
          >
            <div className="card h-full min-h-0 overflow-hidden p-1.5">
              <ExplorerMap
                parcels={mapParcels}
                selectedObjectId={selectedId}
                onSelect={handleSelect}
                className="border-0 shadow-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile filters sheet */}
      {filtersOpen ? (
        <>
          <button
            type="button"
            aria-label="Close filters"
            className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
            onClick={() => setFiltersOpen(false)}
          />
          <div
            id="explorer-filters-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(100%,20rem)] flex-col shadow-xl lg:hidden"
          >
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onSearch={handleSearch}
              onPreset={handlePreset}
              searching={activeQuery.isFetching}
              onClose={() => setFiltersOpen(false)}
              className="h-full rounded-none border-0 shadow-none"
            />
          </div>
        </>
      ) : null}

      <ParcelDrawer
        open={drawerOpen}
        parcel={parcelDetail}
        loading={parcelDetailQuery.isFetching}
        error={parcelDetailQuery.isError}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
