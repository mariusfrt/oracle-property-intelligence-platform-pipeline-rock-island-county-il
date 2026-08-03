import { initTRPC, TRPCError } from "@trpc/server";
import type { ApiContext } from "./context.js";

const t = initTRPC.context<ApiContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const loggedProcedure = publicProcedure.use(async ({ ctx, next, path, type }) => {
  ctx.logger.info("procedure", { path, type });
  return next();
});

export function notWired(message: string): never {
  throw new TRPCError({
    code: "NOT_IMPLEMENTED",
    message,
  });
}
