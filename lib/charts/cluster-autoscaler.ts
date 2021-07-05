
import { StackProps } from "@aws-cdk/core";
import { importCluster } from './cluster-utils';
import cdk = require('@aws-cdk/core');

const CLUSTER_AUTOSCALER = 'cluster-autoscaler';

export class ClusterAutoscaler extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: StackProps) {
        super(scope, id);

        const cluster = importCluster(this, process.env.CLUSTER_NAME);

        const helmChart = cluster.addHelmChart('ClusterAutoscalerChart', {
            chart: CLUSTER_AUTOSCALER,
            release: CLUSTER_AUTOSCALER,
            repository: 'https://kubernetes.github.io/autoscaler',
            namespace: 'kube-system',
            version: '9.9.2',
            wait: true,
            values: {
                autoDiscovery: {
                    clusterName: cluster.clusterName
                },
                awsRegion: cluster.stack.region,
                serviceAccount: {
                    create: false,
                    name: CLUSTER_AUTOSCALER,
                },
                extraArgs: {
                    'stderrthreshold': 'info',
                    'v': 2,
                    'skip-nodes-with-local-storage': false,
                    // scale-down-utilization-threshold: 0.5
                    // scale-down-non-empty-candidates-count: 30
                    // max-node-provision-time: 15m0s
                    // scale-down-unneeded-time: 30m
                    // skip-nodes-with-system-pods: true
                }
            },
        });
    }
}
