#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ApiStack } from "../lib/api-stack.js";

const app = new cdk.App();

new ApiStack(app, "OracleRockIslandApiStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-2",
  },
  description: "Rock Island County Oracle property intelligence tRPC API",
});

app.synth();
