"use client";

import { useCallback, useMemo, useState } from "react";
import type { SearchParcelsFilters } from "@oracle/shared";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AgentPanel } from "@/components/AgentPanel";
import { ExplorerMap } from "@/components/ExplorerMap";
import { FilterPanel } from "@/components/FilterPanel";
import { ParcelDrawer, type ParcelDetail } from "@/components/ParcelDrawer";
import { ResultsTable } from "@/components/ResultsTable";
import { ViewToggle } from "@/components/ViewToggle";
import { mapParcelRows } from "@/lib/parcel-rows";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { trpc } from "@/lib/trpc-react";

const PAGE_SIZE = 50;

type QueryMode = "idle" | "search";
type ResultsMode = "search" | "agent";
type MobileView = "list" | "map";

/** Explorer, MapLibre + table + filters + agent + detail drawer. */
export default function ExplorerPage() {
  const [filters, setFilters] = useState<SearchParcelsFilters>({});
  const [page, setPage] = useState(1);
  const [queryMode, setQueryMode] = useState<QueryMode>("idle");
  const [resultsMode, setResultsMode] = useState<ResultsMode>("search");
  const [agentParcels, setAgentParcels] = useState<Record<string, unknown>[]>([]);
  const [agentQuestion, setAgentQuestion] = useState<string | null>(null);
  const [agentMatchedTotal, setAgentMatchedTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("list");

  // Debounced so typing in the filters (especially free text) does not fire a
  // request on every keystroke. Memoized input keeps the debounce timer stable.
  const searchInput = useMemo(
    () => ({ ...filters, page, pageSize: PAGE_SIZE }),
    [filters, page],
  );
  const debouncedInput = useDebouncedValue(searchInput, 350);
  const searchQuery = trpc.parcels.searchParcels.useQuery(debouncedInput, {
    enabled: queryMode === "search",
  });

  const searchRows = mapParcelRows((searchQuery.data?.rows ?? []) as Record<string, unknown>[]);
  const agentRows = mapParcelRows(agentParcels);
  const rows = resultsMode === "agent" ? agentRows : searchRows;
  const total = resultsMode === "agent" ? agentRows.length : (searchQuery.data?.total ?? 0);

  const parcelDetailQuery = trpc.parcels.parcel.useQuery(
    { objectid: selectedId ?? 0 },
    { enabled: drawerOpen && selectedId != null },
  );

  const handleSearch = useCallback(() => {
    setQueryMode("search");
    setResultsMode("search");
    setPage(1);
    setFiltersOpen(false);
    setSelectedId(null);
    setDrawerOpen(false);
  }, []);

  const handleAgentResult = useCallback(
    (parcels: Record<string, unknown>[], question: string, matchedTotal: number) => {
      setAgentParcels(parcels);
      setAgentQuestion(question);
      setAgentMatchedTotal(matchedTotal);
      setResultsMode("agent");
      setFiltersOpen(false);
      setMobileView("list");
      setSelectedId(null);
      setDrawerOpen(false);
    },
    [],
  );

  const handleBackToSearch = useCallback(() => {
    setResultsMode("search");
  }, []);

  const handleSelect = useCallback((objectid: number) => {
    setSelectedId(objectid);
    setDrawerOpen(true);
  }, []);

  const parcelDetail: ParcelDetail | null = parcelDetailQuery.data?.parcel
    ? (parcelDetailQuery.data.parcel as ParcelDetail)
    : null;

  const emptyMessage =
    resultsMode === "agent"
      ? "The agent did not return matching parcels for this question."
      : queryMode === "idle"
        ? "Set filters and click Search, or ask the agent a question."
        : searchQuery.isError
          ? "Unable to load parcels right now. Please try again."
          : "No results match the current filters.";

  // Memoized so its reference only changes when the underlying result set changes.
  // A new array every render would make the map re-run its fit/render effects on
  // every interaction (e.g. selecting a parcel), breaking auto-fit.
  const mapParcels = useMemo(() => {
    const src = (
      resultsMode === "agent" ? agentParcels : (searchQuery.data?.rows ?? [])
    ) as Record<string, unknown>[];
    return mapParcelRows(src).map((r) => ({
      objectid: r.objectid,
      geom_geojson: r.geom_geojson ?? null,
      label: r.pin ?? String(r.objectid),
    }));
  }, [resultsMode, agentParcels, searchQuery.data]);

  const resultsProps = {
    rows,
    selectedObjectId: selectedId,
    onSelect: handleSelect,
    loading: resultsMode === "search" && searchQuery.isFetching && queryMode !== "idle",
    isError: resultsMode === "search" && searchQuery.isError && queryMode !== "idle",
    emptyMessage,
    total: resultsMode === "agent" ? agentRows.length : queryMode === "idle" ? undefined : total,
    page: resultsMode === "agent" ? 1 : page,
    pageSize: resultsMode === "agent" ? Math.max(agentRows.length, 1) : PAGE_SIZE,
    onPageChange: resultsMode === "agent" ? undefined : setPage,
  } as const;

  const leftColumn = (
    <>
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onSearch={handleSearch}
        searching={searchQuery.isFetching}
        className="max-h-[40%] shrink-0"
      />
      <AgentPanel
        filters={filters}
        onResult={handleAgentResult}
        className="min-h-0 flex-1"
      />
    </>
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden px-3 py-3 sm:px-4 lg:px-6">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="btn-secondary text-sm"
          aria-expanded={filtersOpen}
          aria-controls="explorer-filters-sheet"
        >
          Filters & agent
        </button>
        <ViewToggle value={mobileView} onChange={setMobileView} />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden min-h-0 gap-3 lg:flex lg:flex-col">{leftColumn}</div>

        <div className="relative min-h-0 min-w-0 overflow-hidden lg:grid lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:gap-3">
          <div
            className={`absolute inset-0 flex min-h-0 min-w-0 flex-col gap-2 ${
              mobileView === "list" ? "z-10" : "invisible pointer-events-none z-0"
            } lg:static lg:visible lg:pointer-events-auto lg:z-auto`}
          >
            {resultsMode === "agent" ? (
              <div className="flex shrink-0 flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-indigo-950">
                      Agent results
                      <span className="ml-1.5 font-normal tabular-nums text-indigo-700">
                        ({agentRows.length})
                      </span>
                    </p>
                    {agentQuestion ? (
                      <p className="mt-0.5 truncate text-xs text-indigo-800/80" title={agentQuestion}>
                        {agentQuestion}
                      </p>
                    ) : null}
                    {agentMatchedTotal > agentRows.length ? (
                      <p className="mt-1 text-[11px] font-medium text-indigo-700">
                        Showing {agentRows.length} of {agentMatchedTotal.toLocaleString()} matching
                        parcels on the map and list. The agent answer reflects the full set.
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBackToSearch}
                  className="btn-secondary shrink-0 gap-1.5 self-start text-xs sm:self-auto"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Back to search results
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-800">
                  Search results
                  {queryMode !== "idle" ? (
                    <span className="ml-1.5 font-normal tabular-nums text-slate-500">
                      ({total.toLocaleString()})
                    </span>
                  ) : null}
                </p>
              </div>
            )}
            <ResultsTable {...resultsProps} className="min-h-0 flex-1" />
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
            aria-label="Filters and agent"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(100%,20rem)] flex-col gap-3 overflow-y-auto bg-slate-100 p-3 shadow-xl lg:hidden"
          >
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onSearch={handleSearch}
              searching={searchQuery.isFetching}
              onClose={() => setFiltersOpen(false)}
              className="shrink-0"
            />
            <AgentPanel
              filters={filters}
              onResult={handleAgentResult}
              className="min-h-[16rem] shrink-0"
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
