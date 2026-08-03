import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createOracleMcpServer } from "./server.js";

function requestPath(event: APIGatewayProxyEventV2): string {
  return event.requestContext?.http?.path ?? event.rawPath ?? "";
}

function requestMethod(event: APIGatewayProxyEventV2): string {
  return (event.requestContext?.http?.method ?? "GET").toUpperCase();
}

function eventToWebRequest(event: APIGatewayProxyEventV2): Request {
  const method = requestMethod(event);
  const path = requestPath(event);
  const host =
    event.headers?.host ??
    event.headers?.Host ??
    event.requestContext?.domainName ??
    "localhost";
  const proto =
    event.headers?.["x-forwarded-proto"] ??
    event.headers?.["X-Forwarded-Proto"] ??
    "https";
  const qs = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = `${proto}://${host}${path}${qs}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value != null) headers.set(key, value);
  }

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (event.body) {
      body = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf8")
        : event.body;
    }
  }

  return new Request(url, { method, headers, body });
}

async function webResponseToApiGateway(
  response: Response,
): Promise<APIGatewayProxyStructuredResultV2> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const body = await response.text();
  return {
    statusCode: response.status,
    headers,
    body,
  };
}

function methodNotAllowed(): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 405,
    headers: {
      Allow: "POST",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      error: "Method Not Allowed",
      message:
        "This MCP endpoint is stateless Streamable HTTP (JSON). Use POST /mcp. GET streaming is not supported on API Gateway.",
    }),
  };
}

/**
 * Lambda MCP handler: stateless Streamable HTTP in JSON response mode (no SSE).
 */
export async function mcpHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = requestMethod(event);
  if (method === "GET") {
    return methodNotAllowed();
  }
  if (method !== "POST") {
    return {
      statusCode: 405,
      headers: { Allow: "POST", "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const server = createOracleMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const request = eventToWebRequest(event);
    let parsedBody: unknown;
    if (event.body) {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf8")
        : event.body;
      parsedBody = raw ? JSON.parse(raw) : undefined;
    }
    const response = await transport.handleRequest(request, { parsedBody });
    return webResponseToApiGateway(response);
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw) as unknown;
}

/**
 * Node HTTP MCP handler for the local API dev server and MCP Inspector.
 */
export async function handleMcpNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET") {
    res.writeHead(405, {
      Allow: "POST",
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        error: "Method Not Allowed",
        message:
          "This MCP endpoint is stateless Streamable HTTP (JSON). Use POST /mcp.",
      }),
    );
    return;
  }

  if (method !== "POST") {
    res.writeHead(405, { Allow: "POST", "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  const server = createOracleMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const parsedBody = await readJsonBody(req);
    await transport.handleRequest(req, res, parsedBody);
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

export function isMcpPath(pathname: string): boolean {
  return pathname === "/mcp" || pathname.endsWith("/mcp");
}
