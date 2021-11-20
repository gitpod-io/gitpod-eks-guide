#!/usr/bin/env node

import 'source-map-support/register';

import { App } from '@aws-cdk/core';
import { ServicesStack } from '../lib/services';
import { AddonsStack } from '../lib/addons';
import { GitpodStack } from '../lib/gitpod';
import { SetupStack } from '../lib/setup';

const app = new App({});

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
  region,
};

const setup = new SetupStack(app, 'Setup', {
  env,
  identityoidcissuer,
});

const addons = new AddonsStack(app, 'Addons', {
  env,
});
addons.node.addDependency(setup);

const services = new ServicesStack(app, 'Services', {
  env,
})
services.node.addDependency(setup);

const gitpod = new GitpodStack(app, 'Gitpod', {
  env,
  domain,
  certificateArn,
})
gitpod.node.addDependency(services);
gitpod.node.addDependency(addons);
