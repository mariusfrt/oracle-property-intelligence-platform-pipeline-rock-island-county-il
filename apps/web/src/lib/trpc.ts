import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client";
import type { AppRouter } from "@oracle/api/router";
import { getApiUrl } from "./trpc-react";

export { getApiUrl };

export function createApiClient(): TRPCClient<AppRouter> {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: getApiUrl(),
      }),
    ],
  });
}
