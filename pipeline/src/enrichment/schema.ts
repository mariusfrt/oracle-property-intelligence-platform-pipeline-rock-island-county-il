const WGS84 = "EPSG:4326";
const UTM = "EPSG:32615";

export const CREATE_POWER_LINES_SQL = `
CREATE OR REPLACE TABLE power_lines (
  id          TEXT,
  owner       TEXT,
  voltage     DOUBLE,
  volt_class  TEXT,
  status      TEXT,
  geom        GEOMETRY,
  source_url  TEXT,
  retrieved_at TIMESTAMP
);
`;

export const CREATE_POWER_SUBSTATIONS_SQL = `
CREATE OR REPLACE TABLE power_substations (
  osm_id       TEXT,
  name         TEXT,
  geom         GEOMETRY,
  source_url   TEXT,
  retrieved_at TIMESTAMP
);
`;

export const CREATE_POI_SQL = `
CREATE OR REPLACE TABLE poi (
  osm_id       TEXT,
  kind         TEXT,
  name         TEXT,
  geom         GEOMETRY,
  source_url   TEXT,
  retrieved_at TIMESTAMP
);
`;

export function buildParcelsEnrichedSql(
  powerRadiusM: number,
  minAcres: number,
): string {
  return `
CREATE OR REPLACE TABLE parcels_enriched AS
WITH parcel_pts AS (
  SELECT
    objectid,
    ST_Transform(ST_Point(lon, lat), '${WGS84}', '${UTM}', always_xy := true) AS geom_utm
  FROM parcels
  WHERE lon IS NOT NULL AND lat IS NOT NULL
),
trans_dist AS (
  SELECT
    pp.objectid,
    MIN(ST_Distance(
      pp.geom_utm,
      ST_Transform(pl.geom, '${WGS84}', '${UTM}', always_xy := true)
    )) AS dist_transmission_m
  FROM parcel_pts pp
  CROSS JOIN power_lines pl
  WHERE pl.geom IS NOT NULL
  GROUP BY pp.objectid
),
sub_dist AS (
  SELECT
    pp.objectid,
    MIN(ST_Distance(
      pp.geom_utm,
      ST_Transform(ps.geom, '${WGS84}', '${UTM}', always_xy := true)
    )) AS dist_substation_m
  FROM parcel_pts pp
  CROSS JOIN power_substations ps
  WHERE ps.geom IS NOT NULL
  GROUP BY pp.objectid
),
transit_dist AS (
  SELECT
    pp.objectid,
    MIN(ST_Distance(
      pp.geom_utm,
      ST_Transform(poi.geom, '${WGS84}', '${UTM}', always_xy := true)
    )) AS dist_transit_m
  FROM parcel_pts pp
  CROSS JOIN poi
  WHERE poi.kind = 'transit' AND poi.geom IS NOT NULL
  GROUP BY pp.objectid
),
starbucks_dist AS (
  SELECT
    pp.objectid,
    MIN(ST_Distance(
      pp.geom_utm,
      ST_Transform(poi.geom, '${WGS84}', '${UTM}', always_xy := true)
    )) AS dist_starbucks_m
  FROM parcel_pts pp
  CROSS JOIN poi
  WHERE poi.kind = 'starbucks' AND poi.geom IS NOT NULL
  GROUP BY pp.objectid
),
water_dist AS (
  SELECT
    pp.objectid,
    MIN(ST_Distance(
      pp.geom_utm,
      ST_Transform(poi.geom, '${WGS84}', '${UTM}', always_xy := true)
    )) AS dist_water_m
  FROM parcel_pts pp
  CROSS JOIN poi
  WHERE poi.kind = 'water' AND poi.geom IS NOT NULL
  GROUP BY pp.objectid
)
SELECT
  p.*,
  upper(regexp_replace(coalesce(p.zoning, ''), '[?! ]', '', 'g')) AS zoning_norm,
  (upper(regexp_replace(coalesce(p.zoning, ''), '[?! ]', '', 'g')) LIKE 'I%') AS is_industrial,
  coalesce(p.gis_acres, p.gross_acres) AS acreage,
  greatest(p.date_last_sale, p.date_of_sale) AS last_sale,
  date_diff('year', greatest(p.date_last_sale, p.date_of_sale), current_date) AS years_since_sale,
  (
    greatest(p.date_last_sale, p.date_of_sale) IS NULL
    OR date_diff('year', greatest(p.date_last_sale, p.date_of_sale), current_date) > 10
  ) AS stable_ownership,
  (p.owner_state IS NOT NULL AND upper(trim(p.owner_state)) <> 'IL') AS owner_out_of_area,
  (year(current_date) - p.year_built) AS roof_age_proxy_yrs,
  td.dist_transmission_m,
  sd.dist_substation_m,
  trd.dist_transit_m,
  sbd.dist_starbucks_m,
  wd.dist_water_m,
  (trd.dist_transit_m IS NOT NULL AND trd.dist_transit_m <= 800) AS near_transit,
  (sbd.dist_starbucks_m IS NOT NULL AND sbd.dist_starbucks_m <= 800) AS near_starbucks,
  (wd.dist_water_m IS NOT NULL AND wd.dist_water_m <= 300) AS near_water,
  (
    least(
      coalesce(td.dist_transmission_m, 1e18),
      coalesce(sd.dist_substation_m, 1e18)
    ) <= ${powerRadiusM}
  ) AS near_power,
  (
    coalesce(p.gis_acres, p.gross_acres) >= ${minAcres}
    AND upper(regexp_replace(coalesce(p.zoning, ''), '[?! ]', '', 'g')) LIKE 'I%'
    AND (
      greatest(p.date_last_sale, p.date_of_sale) IS NULL
      OR date_diff('year', greatest(p.date_last_sale, p.date_of_sale), current_date) > 10
    )
    AND least(
      coalesce(td.dist_transmission_m, 1e18),
      coalesce(sd.dist_substation_m, 1e18)
    ) <= ${powerRadiusM}
  ) AS dc_candidate
FROM parcels p
LEFT JOIN trans_dist td ON p.objectid = td.objectid
LEFT JOIN sub_dist sd ON p.objectid = sd.objectid
LEFT JOIN transit_dist trd ON p.objectid = trd.objectid
LEFT JOIN starbucks_dist sbd ON p.objectid = sbd.objectid
LEFT JOIN water_dist wd ON p.objectid = wd.objectid;
`;
}
