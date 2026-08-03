"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { ParcelResultRow } from "@/lib/parcel-rows";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { TableSkeleton } from "@/components/ui/Skeleton";

type SortKey = "pin" | "site_address" | "acreage" | "zoning" | "owner_name" | "dist_to_power_m";

interface ResultsTableProps {
  rows: ParcelResultRow[];
  selectedObjectId?: number | null;
  onSelect?: (objectid: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  showDistToPower?: boolean;
  showRank?: boolean;
  isError?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

function powerBadgeVariant(meters: number): "success" | "default" | "muted" {
  if (meters <= 500) return "success";
  if (meters <= 1609) return "default";
  return "muted";
}

export function ResultsTable({
  rows,
  selectedObjectId,
  onSelect,
  loading = false,
  emptyMessage = "No results match the current filters.",
  showDistToPower = false,
  showRank = false,
  isError = false,
  total,
  page,
  pageSize,
  onPageChange,
  className = "",
}: ResultsTableProps) {
  const colSpan = (showDistToPower ? 1 : 0) + (showRank ? 1 : 0) + 5;
  const totalPages =
    total != null && pageSize != null && pageSize > 0 ? Math.ceil(total / pageSize) : null;

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    const numeric = sortKey === "acreage" || sortKey === "dist_to_power_m";
    const val = (r: ParcelResultRow): string | number | null => {
      const v = r[sortKey];
      if (sortKey === "dist_to_power_m" && typeof v === "number" && v >= 1e17) return null;
      return v ?? null;
    };
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (numeric) return ((av as number) - (bv as number)) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortHeader({ sortableKey, label, align }: { sortableKey: SortKey; label: string; align?: "right" }) {
    const active = sortKey === sortableKey;
    const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th className={`label-caps px-3 py-2.5 font-medium ${align === "right" ? "text-right" : ""}`}>
        <button
          type="button"
          onClick={() => toggleSort(sortableKey)}
          className={`inline-flex items-center gap-1 hover:text-slate-900 focus-ring rounded ${
            active ? "text-slate-900" : ""
          } ${align === "right" ? "flex-row-reverse" : ""}`}
          aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        >
          {label}
          <Icon className={`h-3 w-3 ${active ? "text-indigo-600" : "opacity-40"}`} aria-hidden />
        </button>
      </th>
    );
  }

  return (
    <div className={`card flex min-h-0 flex-col overflow-hidden p-0 ${className}`}>
      <div className="shrink-0 border-b border-slate-200 px-4 py-3">
        <p className="label-caps mb-0.5">Results</p>
        <p className="text-sm text-slate-600">
          {loading ? (
            "Loading…"
          ) : total != null && page != null && pageSize != null ? (
            <>
              <span className="font-medium tabular-nums text-slate-900">
                {total.toLocaleString()}
              </span>{" "}
              result{total === 1 ? "" : "s"}
              {totalPages != null && totalPages > 1 ? (
                <span className="text-slate-500">
                  {" "}
                  · page <span className="tabular-nums">{page}</span> of{" "}
                  <span className="tabular-nums">{totalPages}</span>
                </span>
              ) : null}
            </>
          ) : (
            "Awaiting search"
          )}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && rows.length === 0 ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={Math.min(colSpan, 4)} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState message={emptyMessage} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState message={emptyMessage} />
          </div>
        ) : (
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200 text-left">
                {showRank ? (
                  <th className="label-caps w-12 px-3 py-2.5 font-medium">#</th>
                ) : null}
                <SortHeader sortableKey="pin" label="PIN" />
                <SortHeader sortableKey="site_address" label="Address" />
                <SortHeader sortableKey="acreage" label="Acres" align="right" />
                <SortHeader sortableKey="zoning" label="Zoning" />
                <SortHeader sortableKey="owner_name" label="Owner" />
                {showDistToPower ? (
                  <SortHeader sortableKey="dist_to_power_m" label="Power" align="right" />
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.map((row, index) => {
                const rank =
                  page != null && pageSize != null ? (page - 1) * pageSize + index + 1 : index + 1;
                const distPower =
                  row.dist_to_power_m != null && row.dist_to_power_m < 1e17
                    ? Math.round(row.dist_to_power_m)
                    : null;
                const selected = row.objectid === selectedObjectId;

                return (
                  <tr
                    key={row.objectid}
                    onClick={() => onSelect?.(row.objectid)}
                    className={`transition ${
                      onSelect ? "cursor-pointer hover:bg-indigo-50/50" : ""
                    } ${selected ? "bg-indigo-50" : index % 2 === 1 ? "bg-slate-50/40" : ""}`}
                  >
                    {showRank ? (
                      <td className="px-3 py-2.5 tabular-nums font-medium text-slate-500">
                        {rank}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800">
                      {row.pin ?? row.objectid}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2.5 text-slate-600">
                      {row.site_address ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-medium text-slate-900">
                      {row.acreage != null ? row.acreage.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.zoning ? (
                        <Badge variant="muted">{row.zoning}</Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="max-w-[8rem] truncate px-3 py-2.5 text-slate-600">
                      {row.owner_name ?? "-"}
                    </td>
                    {showDistToPower ? (
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        {distPower != null ? (
                          <Badge variant={powerBadgeVariant(distPower)}>
                            {distPower.toLocaleString()} m
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {onPageChange && page != null && totalPages != null && totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-4 py-2.5">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            className="btn-secondary text-xs"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className="btn-secondary text-xs"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
