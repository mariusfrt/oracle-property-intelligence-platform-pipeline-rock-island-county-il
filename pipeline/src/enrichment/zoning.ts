/** Mirrors SQL: upper(regexp_replace(zoning, '[?! ]', '', 'g')) */
export function normalizeZoning(zoning: string | null | undefined): string {
  if (zoning == null) return "";
  return zoning.replace(/[?! ]/g, "").toUpperCase();
}

/** Mirrors SQL: zoning_norm LIKE 'I%' */
export function isIndustrialZoning(zoningNorm: string): boolean {
  return zoningNorm.startsWith("I");
}
