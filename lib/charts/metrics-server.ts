import * as cdk from "@aws-cdk/core";
import { StackProps } from '@aws-cdk/core';
import { importCluster } from './cluster-utils';

export class MetricsServer extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: StackProps) {
        super(scope, id);

        const cluster = importCluster(this, process.env.CLUSTER_NAME);

        const helmChart = cluster.addHelmChart('MetricsServerChart', {
            chart: 'metrics-server',
            release: 'metrics-server',
            repository: 'https://charts.bitnami.com/bitnami',
            namespace: 'kube-system',
            version: '5.8.15',
            wait: true,
            values: {
                hostNetwork: true,
                apiService: {
                    create: true
                },
                extraArgs: {
                    'v': '2',
                    'kubelet-preferred-address-types': 'InternalIP, ExternalIP, Hostname'
                }
            },
        });
    }
}
