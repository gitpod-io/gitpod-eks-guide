import * as cdk from "@aws-cdk/core";
import { loadExternalYaml } from "./utils";
import { StackProps } from '@aws-cdk/core';
import { importCluster } from './cluster-utils';

export class MetricsServer extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: StackProps) {
        super(scope, id);

        const cluster = importCluster(this, process.env.CLUSTER_NAME);

        const manifestUrl = `https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.5.0/components.yaml`;
        const manifest = loadExternalYaml(manifestUrl);
        cluster.addManifest('metrics-server', ...manifest);
    }
}
