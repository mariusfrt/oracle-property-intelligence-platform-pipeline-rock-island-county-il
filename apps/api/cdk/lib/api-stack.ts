import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ApiStackProps extends cdk.StackProps {}

/**
 * API Gateway HTTP API + Lambda (tRPC) querying a Parquet file bundled into the
 * function asset via native DuckDB (@duckdb/node-api). Region: us-east-2.
 *
 * Eligible non-PII artifacts may be published to IPFS separately; the full
 * dataset (with owner PII) stays in the Lambda asset and access-gated API.
 *
 * NOT deployed by default — run `pnpm --filter @oracle/api cdk deploy` when ready.
 */
export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps = {}) {
    super(scope, id, {
      ...props,
      env: { region: "us-east-2", account: props.env?.account },
      tags: { project_name: "oracle-rock-island" },
    });

    const localParquetPath = path.resolve(
      __dirname,
      "../../../../data/parquet/parcels_enriched_api.parquet",
    );
    const localIpfsManifestPath = path.resolve(
      __dirname,
      "../../../../data/ipfs-manifest.json",
    );

    const handler = new nodejs.NodejsFunction(this, "TrpcHandler", {
      entry: path.join(__dirname, "../../src/handler.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler",
      memorySize: 1536,
      timeout: cdk.Duration.seconds(60),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        POWERTOOLS_SERVICE_NAME: "oracle-rock-island-api",
        POWERTOOLS_METRICS_NAMESPACE: "OracleRockIsland",
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
        // Relative to /var/task — file is copied into the asset via commandHooks.
        PARQUET_PATH: "parcels_enriched_api.parquet",
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: "node22",
        // ESM output so `import.meta.url` resolves at runtime (createRequire /
        // fileURLToPath in db/duckdb.ts). CJS output leaves import.meta empty and
        // the handler throws on load. Matches the ESM source + local tsx runtime.
        format: nodejs.OutputFormat.ESM,
        // ESM output turns `require` into a stub that throws "Dynamic require not
        // supported". Bundled CJS deps (powertools → aws-xray-sdk-core → cls-hooked)
        // call require() at runtime, so recreate a real require via this banner;
        // esbuild's stub then falls back to it. Also restores __filename/__dirname.
        banner: [
          "import { createRequire as __cdkCreateRequire } from 'module';",
          "import { fileURLToPath as __cdkFileURLToPath } from 'url';",
          "import { dirname as __cdkDirname } from 'path';",
          "const require = __cdkCreateRequire(import.meta.url);",
          "const __filename = __cdkFileURLToPath(import.meta.url);",
          "const __dirname = __cdkDirname(__filename);",
        ].join("\n"),
        // Keep native DuckDB as a real node_module (native bindings, not esbuild-inlined).
        nodeModules: ["@duckdb/node-api"],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (_inputDir: string, outputDir: string): string[] => [
            // Bundle the Parquet into the Lambda asset for read_parquet at runtime.
            `cp "${localParquetPath}" "${path.join(outputDir, "parcels_enriched_api.parquet")}"`,
            // Optional IPFS manifest (may be absent until publish-ipfs has been run).
            `if [ -f "${localIpfsManifestPath}" ]; then cp "${localIpfsManifestPath}" "${path.join(outputDir, "ipfs-manifest.json")}"; fi`,
            // Force-install the linux-x64 binding so Lambda has the right binary
            // even when synthesizing on macOS (--force bypasses npm's libc check).
            `npm install --prefix "${outputDir}" --no-save --no-audit --no-fund --force @duckdb/node-bindings-linux-x64@1.5.5-r.3`,
            // Drop the host (darwin) binding CDK installed — dead weight on a linux
            // Lambda (~68MB with its own libduckdb.so); keeps the asset well under 250MB.
            `rm -rf "${path.join(outputDir, "node_modules/@duckdb/node-bindings-darwin-x64")}" "${path.join(outputDir, "node_modules/@duckdb/node-bindings-darwin-arm64")}"`,
          ],
        },
      },
    });

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: [
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5*",
          "arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-sonnet-4-5*",
        ],
      }),
    );

    this.httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "oracle-rock-island-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "Accept",
          "Mcp-Session-Id",
          "MCP-Protocol-Version",
        ],
      },
    });

    const lambdaIntegration = new integrations.HttpLambdaIntegration(
      "TrpcIntegration",
      handler,
    );

    // Explicit MCP routes BEFORE the catch-all so /mcp is not swallowed by tRPC.
    this.httpApi.addRoutes({
      path: "/mcp",
      methods: [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.httpApi.apiEndpoint,
      description: "API Gateway URL. Set as NEXT_PUBLIC_API_URL for apps/web. MCP: POST {ApiUrl}/mcp",
    });
  }
}
