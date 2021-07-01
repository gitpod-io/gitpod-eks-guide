#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from '@aws-cdk/core';
import { MainApp } from '../lib/main';

const app = new cdk.App({});

const clusterName = app.node.tryGetContext('clustername');
if (!clusterName) {
  throw new Error("clusterName is not defined.");
}

const region = app.node.tryGetContext('region');
if (!region) {
  throw new Error("region is not defined.");
}

const domain = app.node.tryGetContext('domain');
if (!domain) {
  throw new Error("domain is not defined.");
}

const identityoidcissuer = app.node.tryGetContext('identityoidcissuer');
if (!identityoidcissuer) {
  throw new Error("identityoidcissuer is not defined.");
}

const certificateArn = app.node.tryGetContext('certificatearn');
if (!certificateArn) {
  throw new Error("certificateArn is not defined.");
}

const env = {
  account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region
};

new MainApp(app, 'Gitpod', {
  env,
  clusterName,
  domain,
  identityoidcissuer,
  certificateArn
})
