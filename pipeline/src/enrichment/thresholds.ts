import {
  DEFAULT_MIN_ACRES,
  DEFAULT_POWER_RADIUS_M,
  STARBUCKS_WALK_THRESHOLD_M,
  TRANSIT_WALK_THRESHOLD_M,
  WATER_PROXIMITY_THRESHOLD_M,
} from "./constants.js";

export interface ProximityDistances {
  distTransmissionM: number | null;
  distSubstationM: number | null;
  distTransitM: number | null;
  distStarbucksM: number | null;
  distWaterM: number | null;
}

export interface ProximityFlags extends ProximityDistances {
  nearTransit: boolean;
  nearStarbucks: boolean;
  nearWater: boolean;
  nearPower: boolean;
}

export interface DcCandidateInput {
  acreage: number | null;
  isIndustrial: boolean;
  stableOwnership: boolean;
  nearPower: boolean;
}

export function nearestPowerDistanceM(
  distTransmissionM: number | null,
  distSubstationM: number | null,
): number | null {
  const candidates = [distTransmissionM, distSubstationM].filter(
    (d): d is number => d != null && Number.isFinite(d),
  );
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

export function isNearDistance(
  distanceM: number | null,
  thresholdM: number,
): boolean {
  return distanceM != null && distanceM <= thresholdM;
}

export function computeProximityFlags(
  distances: ProximityDistances,
  powerRadiusM: number = DEFAULT_POWER_RADIUS_M,
): ProximityFlags {
  const nearestPower = nearestPowerDistanceM(
    distances.distTransmissionM,
    distances.distSubstationM,
  );

  return {
    ...distances,
    nearTransit: isNearDistance(distances.distTransitM, TRANSIT_WALK_THRESHOLD_M),
    nearStarbucks: isNearDistance(distances.distStarbucksM, STARBUCKS_WALK_THRESHOLD_M),
    nearWater: isNearDistance(distances.distWaterM, WATER_PROXIMITY_THRESHOLD_M),
    nearPower: isNearDistance(nearestPower, powerRadiusM),
  };
}

export function isStableOwnership(
  lastSale: Date | string | null,
  yearsSinceSale: number | null,
  thresholdYears: number = 10,
): boolean {
  if (lastSale == null) return true;
  if (yearsSinceSale == null) return false;
  return yearsSinceSale > thresholdYears;
}

export function isOwnerOutOfArea(ownerState: string | null | undefined): boolean {
  if (ownerState == null) return false;
  return ownerState.trim().toUpperCase() !== "IL";
}

export function computeDcCandidate(
  input: DcCandidateInput,
  minAcres: number = DEFAULT_MIN_ACRES,
): boolean {
  if (input.acreage == null || input.acreage < minAcres) return false;
  if (!input.isIndustrial) return false;
  if (!input.stableOwnership) return false;
  if (!input.nearPower) return false;
  return true;
}
