"use client";

export interface ParcelDetail {
  objectid: number;
  pin?: string | null;
  site_address?: string | null;
  acreage?: number | null;
  zoning?: string | null;
  owner_name?: string | null;
  dist_transmission_m?: number | null;
  dist_substation_m?: number | null;
  dist_transit_m?: number | null;
  dist_starbucks_m?: number | null;
  dist_water_m?: number | null;
  source_system?: string | null;
  source_url?: string | null;
  retrieved_at?: string | null;
  [key: string]: unknown;
}

interface ParcelDrawerProps {
  parcel: ParcelDetail | null;
  open: boolean;
  onClose: () => void;
}

export function ParcelDrawer({ parcel, open, onClose }: ParcelDrawerProps) {
  if (!open) return null;

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 360,
        height: "100%",
        background: "#fff",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
        padding: 16,
        overflowY: "auto",
        zIndex: 50,
      }}
    >
      <button type="button" onClick={onClose} style={{ float: "right" }}>
        Close
      </button>
      <h2>Parcel detail</h2>
      {!parcel ? (
        <p>Select a parcel or wire <code>parcels.parcel</code> to load detail.</p>
      ) : (
        <>
          <dl>
            <dt>Object ID</dt>
            <dd>{parcel.objectid}</dd>
            <dt>PIN</dt>
            <dd>{parcel.pin ?? "—"}</dd>
            <dt>Address</dt>
            <dd>{parcel.site_address ?? "—"}</dd>
            <dt>Acreage</dt>
            <dd>{parcel.acreage ?? "—"}</dd>
            <dt>Zoning</dt>
            <dd>{parcel.zoning ?? "—"}</dd>
            <dt>Owner</dt>
            <dd>{parcel.owner_name ?? "—"}</dd>
          </dl>
          <h3>Distances (m)</h3>
          <ul>
            <li>Transmission: {parcel.dist_transmission_m ?? "—"}</li>
            <li>Substation: {parcel.dist_substation_m ?? "—"}</li>
            <li>Transit: {parcel.dist_transit_m ?? "—"}</li>
            <li>Starbucks: {parcel.dist_starbucks_m ?? "—"}</li>
            <li>Water: {parcel.dist_water_m ?? "—"}</li>
          </ul>
          <h3>Provenance</h3>
          <ul>
            <li>{parcel.source_system ?? "—"}</li>
            <li>{parcel.retrieved_at ?? "—"}</li>
            {parcel.source_url ? (
              <li>
                <a href={parcel.source_url} target="_blank" rel="noreferrer">
                  Source URL
                </a>
              </li>
            ) : null}
          </ul>
        </>
      )}
    </aside>
  );
}
