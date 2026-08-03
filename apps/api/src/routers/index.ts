import { agentRouter } from "./agent.js";
import { artifactsRouter } from "./artifacts.js";
import { parcelsRouter } from "./parcels.js";
import { router } from "../trpc.js";

export const appRouter = router({
  parcels: parcelsRouter,
  agent: agentRouter,
  artifacts: artifactsRouter,
});

export type AppRouter = typeof appRouter;
