import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client";
import type { AppRouter } from "@oracle/api/router";

function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    return "http://localhost:3001";
  }
  return url.replace(/\/$/, "");
}

export function createApiClient(): TRPCClient<AppRouter> {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: getApiUrl(),
      }),
    ],
  });
}
