import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context as LambdaContext,
} from "aws-lambda";
import type { CreateAWSLambdaContextOptions } from "@trpc/server/adapters/aws-lambda";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { appRouter } from "./routers/index.js";
import { createApiContext } from "./context.js";
import { isMcpPath, mcpHandler } from "./mcp/http.js";

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

const trpcHandler = awsLambdaRequestHandler({
  router: appRouter,
  createContext,
});

function resolvePath(event: APIGatewayProxyEventV2): string {
  return event.requestContext?.http?.path ?? event.rawPath ?? "";
}

/**
 * API Gateway entry: route /mcp to the MCP Streamable HTTP handler;
 * everything else to tRPC.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
  context: LambdaContext,
): Promise<APIGatewayProxyStructuredResultV2 | unknown> {
  const path = resolvePath(event);
  if (isMcpPath(path)) {
    return mcpHandler(event);
  }
  return trpcHandler(event, context);
}
