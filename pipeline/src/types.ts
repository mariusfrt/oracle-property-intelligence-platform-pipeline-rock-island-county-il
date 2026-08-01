export interface Geometry {
  type: string;
  coordinates: unknown;
}

export interface Feature {
  type: "Feature";
  geometry: Geometry | null;
  properties: Record<string, unknown> | null;
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

export interface ArcGisQueryResponse extends FeatureCollection {
  exceededTransferLimit?: boolean;
}
