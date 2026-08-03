import { parcelsRouter } from "./parcels.js";
import { router } from "../trpc.js";

export const appRouter = router({
  parcels: parcelsRouter,
});

export type AppRouter = typeof appRouter;
