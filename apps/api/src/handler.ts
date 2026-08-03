import type { APIGatewayProxyEventV2, Context as LambdaContext } from "aws-lambda";
import type { CreateAWSLambdaContextOptions } from "@trpc/server/adapters/aws-lambda";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { appRouter } from "./routers/index.js";
import { createApiContext } from "./context.js";

const logger = new Logger({ serviceName: "oracle-rock-island-api" });
const tracer = new Tracer({ serviceName: "oracle-rock-island-api" });
const metrics = new Metrics({
  serviceName: "oracle-rock-island-api",
  namespace: "OracleRockIsland",
});

const createContext = ({
  event: _event,
  context: _context,
}: CreateAWSLambdaContextOptions<APIGatewayProxyEventV2>) => {
  return {
    ...createApiContext(logger),
    lambdaContext: _context as LambdaContext,
    tracer,
    metrics,
  };
};

export type HandlerContext = ReturnType<typeof createContext>;

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext,
});
