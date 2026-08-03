import { agentRouter } from "./agent.js";
import { parcelsRouter } from "./parcels.js";
import { router } from "../trpc.js";

export const appRouter = router({
  parcels: parcelsRouter,
  agent: agentRouter,
});

export type AppRouter = typeof appRouter;
