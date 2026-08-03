import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ApiStackProps extends cdk.StackProps {
  /** S3 object key for parcels_enriched_api.parquet (within data bucket). */
  parquetObjectKey?: string;
}

/**
 * API Gateway HTTP API + Lambda (tRPC) reading Parquet from S3 via DuckDB httpfs.
 * Region: us-east-2 (set on Stack env).
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
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        POWERTOOLS_SERVICE_NAME: "oracle-rock-island-api",
        POWERTOOLS_METRICS_NAMESPACE: "OracleRockIsland",
        PARQUET_S3_URI: `s3://${this.dataBucket.bucketName}/${parquetObjectKey}`,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: "node22",
        externalModules: ["duckdb"],
      },
    });

    this.dataBucket.grantRead(handler);

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:ListBucket"],
        resources: [this.dataBucket.bucketArn, `${this.dataBucket.bucketArn}/*`],
      }),
    );

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
      description: "Upload parcels_enriched_api.parquet here",
    });

    new cdk.CfnOutput(this, "ParquetS3Uri", {
      value: `s3://${this.dataBucket.bucketName}/${parquetObjectKey}`,
    });
  }
}
