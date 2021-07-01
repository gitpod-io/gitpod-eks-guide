import * as cdk from "@aws-cdk/core";
import * as eks from "@aws-cdk/aws-eks";
import { loadExternalYaml } from "./utils";

export interface MetricsServerProps extends cdk.StackProps {
    cluster: eks.ICluster
}

export class MetricsServer extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: MetricsServerProps) {
        super(scope, id);

        const manifestUrl = `https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.5.0/components.yaml`;
        const manifest = loadExternalYaml(manifestUrl);
        props.cluster.addManifest('metrics-server', ...manifest);
    }
}
