const MAX_RETRIES = 4;
const RETRY_BASE_MS = 1_000;

const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

export function sleep(ms: number): Promise<void> {
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

export interface FetchRetryOptions extends RequestInit {
  label?: string;
}

export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const { label = url, ...init } = options;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);

      if (!response.ok) {
        if (isRetryableHttpStatus(response.status) && attempt < MAX_RETRIES) {
          const retryAttempt = attempt + 1;
          const delayMs = backoffDelayMs(
            retryAttempt,
            parseRetryAfterMs(response.headers.get("Retry-After")),
          );
          console.log(
            `fetch: retry ${retryAttempt}/${MAX_RETRIES} ${label} HTTP ${response.status}, waiting ${delayMs}ms`,
          );
          await sleep(delayMs);
          continue;
        }
        throw new Error(`HTTP ${response.status} for ${label}`);
      }

      return response;
    } catch (err) {
      if (attempt < MAX_RETRIES && isNetworkError(err)) {
        const retryAttempt = attempt + 1;
        const delayMs = backoffDelayMs(retryAttempt, null);
        const reason = err instanceof Error ? err.message : String(err);
        console.log(
          `fetch: retry ${retryAttempt}/${MAX_RETRIES} ${label} network error (${reason}), waiting ${delayMs}ms`,
        );
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Exhausted retries for ${label}`);
}
