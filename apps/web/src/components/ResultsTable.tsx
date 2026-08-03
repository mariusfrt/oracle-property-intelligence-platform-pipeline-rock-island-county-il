"use client";

export interface ResultRow {
  objectid: number;
  pin?: string | null;
  site_address?: string | null;
  acreage?: number | null;
  zoning?: string | null;
  owner_name?: string | null;
}

interface ResultsTableProps {
  rows: ResultRow[];
  selectedObjectId?: number | null;
  onSelect?: (objectid: number) => void;
}

export function ResultsTable({ rows, selectedObjectId, onSelect }: ResultsTableProps) {
  return (
    <div style={{ overflow: "auto", maxHeight: 420 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>PIN</th>
            <th>Address</th>
            <th>Acres</th>
            <th>Zoning</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>No results — wire API queries to populate this table.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.objectid}
                onClick={() => onSelect?.(row.objectid)}
                style={{
                  cursor: "pointer",
                  background: row.objectid === selectedObjectId ? "#dbeafe" : undefined,
                }}
              >
                <td>{row.pin ?? row.objectid}</td>
                <td>{row.site_address ?? "—"}</td>
                <td>{row.acreage?.toFixed(2) ?? "—"}</td>
                <td>{row.zoning ?? "—"}</td>
                <td>{row.owner_name ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
