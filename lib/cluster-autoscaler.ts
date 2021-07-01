import * as eks from "@aws-cdk/aws-eks";
import cdk = require('@aws-cdk/core');

export interface ClusterAutoscalerProps extends cdk.StackProps {
    cluster: eks.ICluster
    clusterName: string
}

const CLUSTER_AUTOSCALER = 'cluster-autoscaler';

export class ClusterAutoscaler extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: ClusterAutoscalerProps) {
        super(scope, id);

        const cluster = props.cluster;

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
            },
        });
    }
}
