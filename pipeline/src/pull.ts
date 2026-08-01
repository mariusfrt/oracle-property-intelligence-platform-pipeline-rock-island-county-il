import fs from "node:fs/promises";
import path from "node:path";
import {
  buildQueryUrl,
  PAGE_SIZE,
  PATHS,
  PILOT_PAGE_SIZE,
} from "./config.js";
import type { ArcGisQueryResponse } from "./types.js";
import { pageFileName } from "./mapping.js";

export interface PullOptions {
  pilot?: boolean;
  full?: boolean;
}

export interface PullResult {
  pagesWritten: number;
  featureCount: number;
  offsets: number[];
}

const REQUEST_DELAY_MS = 500;
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 1_000;

const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUS.has(status);
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const asSeconds = Number(header);
  if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1_000;
  }
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return null;
}

function backoffDelayMs(retryAttempt: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null) return retryAfterMs;
  return RETRY_BASE_MS * 2 ** (retryAttempt - 1);
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("socket")
    );
  }
  return false;
}

async function ensureRawDir(): Promise<void> {
  await fs.mkdir(PATHS.rawParcels, { recursive: true });
}

async function fetchPageResponse(
  offset: number,
  pageSize: number,
): Promise<{ url: string; response: Response }> {
  const url = buildQueryUrl(offset, pageSize);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/geo+json, application/json" },
      });

      if (!response.ok) {
        if (isRetryableHttpStatus(response.status) && attempt < MAX_RETRIES) {
          const retryAttempt = attempt + 1;
          const delayMs = backoffDelayMs(
            retryAttempt,
            parseRetryAfterMs(response.headers.get("Retry-After")),
          );
          console.log(
            `pull: retry ${retryAttempt}/${MAX_RETRIES} offset=${offset} HTTP ${response.status}, waiting ${delayMs}ms`,
          );
          await sleep(delayMs);
          continue;
        }
        throw new Error(
          `ArcGIS query failed (${response.status}) for offset ${offset}: ${url}`,
        );
      }

      return { url, response };
    } catch (err) {
      if (attempt < MAX_RETRIES && isNetworkError(err)) {
        const retryAttempt = attempt + 1;
        const delayMs = backoffDelayMs(retryAttempt, null);
        const reason = err instanceof Error ? err.message : String(err);
        console.log(
          `pull: retry ${retryAttempt}/${MAX_RETRIES} offset=${offset} network error (${reason}), waiting ${delayMs}ms`,
        );
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`ArcGIS query exhausted retries for offset ${offset}: ${url}`);
}

async function fetchPage(
  offset: number,
  pageSize: number,
): Promise<{ url: string; body: ArcGisQueryResponse; retrievedAt: string }> {
  const { url, response } = await fetchPageResponse(offset, pageSize);
  const body = (await response.json()) as ArcGisQueryResponse;
  if (body.type !== "FeatureCollection" || !Array.isArray(body.features)) {
    throw new Error(`Invalid GeoJSON response at offset ${offset}`);
  }

  return {
    url,
    body,
    retrievedAt: new Date().toISOString(),
  };
}

export async function pullParcels(options: PullOptions = {}): Promise<PullResult> {
  const pilot = options.pilot ?? !options.full;
  const pageSize = pilot ? PILOT_PAGE_SIZE : PAGE_SIZE;

  await ensureRawDir();

  let offset = 0;
  let pagesWritten = 0;
  let featureCount = 0;
  const offsets: number[] = [];

  while (true) {
    const { url, body, retrievedAt } = await fetchPage(offset, pageSize);
    const enriched: ArcGisQueryResponse & {
      _pipeline?: { source_url: string; retrieved_at: string };
    } = {
      ...body,
      _pipeline: { source_url: url, retrieved_at: retrievedAt },
    };

    const outPath = path.join(PATHS.rawParcels, pageFileName(offset));
    await fs.writeFile(outPath, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");

    const count = body.features.length;
    pagesWritten += 1;
    featureCount += count;
    offsets.push(offset);

    console.log(
      `pull: wrote ${outPath} (${count} features, offset=${offset}, pilot=${pilot})`,
    );

    if (pilot) break;
    if (count === 0) break;
    if (count < pageSize && !body.exceededTransferLimit) break;

    offset += pageSize;
    await sleep(REQUEST_DELAY_MS);
  }

  return { pagesWritten, featureCount, offsets };
}
