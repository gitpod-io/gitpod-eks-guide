
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
            version: '9.10.8',
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
                replicaCount: 1,
                extraArgs: {
                    'stderrthreshold': 'info',
                    'v': 2,
                    'scale-down-utilization-threshold': 0.2,
                    'skip-nodes-with-local-storage': false,
                    'skip-nodes-with-system-pods': false,
                    'expander': 'least-waste',
                    'balance-similar-node-groups': true,
                    'node-group-auto-discovery': `asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/${cluster.clusterName}`,
                    'cordon-node-before-terminating': true,
                }
            },
        });
    }
}
