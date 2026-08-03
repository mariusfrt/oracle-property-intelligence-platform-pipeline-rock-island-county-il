import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ApiStackProps extends cdk.StackProps {
  /** S3 object key retained for the later IPFS/publish story (not used at query time). */
  parquetObjectKey?: string;
}

/**
 * API Gateway HTTP API + Lambda (tRPC) querying a Parquet file bundled into the
 * function asset via DuckDB-WASM. Region: us-east-2.
 *
 * Runtime does NOT depend on S3/httpfs — the private bucket is retained for
 * the later publish story only.
 *
 * NOT deployed by default — run `pnpm --filter @oracle/api cdk deploy` when ready.
 */
export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly dataBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: ApiStackProps = {}) {
    super(scope, id, {
      ...props,
      env: { region: "us-east-2", account: props.env?.account },
      tags: { project_name: "oracle-rock-island" },
    });

    const parquetObjectKey = props.parquetObjectKey ?? "parquet/parcels_enriched_api.parquet";
    const localParquetPath = path.resolve(
      __dirname,
      "../../../../data/parquet/parcels_enriched_api.parquet",
    );

    this.dataBucket = new s3.Bucket(this, "ParquetDataBucket", {
      bucketName: undefined,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const handler = new nodejs.NodejsFunction(this, "TrpcHandler", {
      entry: path.join(__dirname, "../../src/handler.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler",
      memorySize: 1536,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        POWERTOOLS_SERVICE_NAME: "oracle-rock-island-api",
        POWERTOOLS_METRICS_NAMESPACE: "OracleRockIsland",
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
        // Keep DuckDB-WASM + worker/wasm assets as real node_modules (not esbuild-inlined).
        nodeModules: ["@duckdb/duckdb-wasm", "apache-arrow", "web-worker"],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (_inputDir: string, outputDir: string): string[] => [
            // Bundle the Parquet into the Lambda asset for registerFileBuffer at runtime.
            `cp "${localParquetPath}" "${path.join(outputDir, "parcels_enriched_api.parquet")}"`,
          ],
        },
      },
    });

    this.httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "oracle-rock-island-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    const lambdaIntegration = new integrations.HttpLambdaIntegration(
      "TrpcIntegration",
      handler,
    );

    this.httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.httpApi.apiEndpoint,
      description: "API Gateway URL — set as NEXT_PUBLIC_API_URL for apps/web",
    });

    new cdk.CfnOutput(this, "ParquetBucketName", {
      value: this.dataBucket.bucketName,
      description: "Retained for later IPFS/publish — not used by the query runtime",
    });

    new cdk.CfnOutput(this, "ParquetS3Uri", {
      value: `s3://${this.dataBucket.bucketName}/${parquetObjectKey}`,
      description: "Optional archive location (runtime uses the bundled Parquet asset)",
    });
  }
}
