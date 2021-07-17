import { KubernetesManifest } from '@aws-cdk/aws-eks';
import { loadYaml, readYamlDocument } from './utils';
import { StackProps } from '@aws-cdk/core';
import { importCluster } from './cluster-utils';
import cdk = require('@aws-cdk/core');
import eks = require('@aws-cdk/aws-eks');

export class Jaeger extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: StackProps) {
        super(scope, id);

        const cluster = importCluster(this, process.env.CLUSTER_NAME);

        const helmChart = cluster.addHelmChart('jaeger-operator-chart', {
            chart: 'jaeger-operator',
            release: 'jaeger-operator',
            repository: 'https://jaegertracing.github.io/helm-charts',
            namespace: 'jaeger-operator',
            version: '2.21.4',
            wait: true,
            values: {
                rbac: {
                    clusterRole: true,
                },
                "affinity": {
                    "nodeAffinity": {
                        "requiredDuringSchedulingIgnoredDuringExecution": {
                            "nodeSelectorTerms": [
                                {
                                    "matchExpressions": [
                                        {
                                            "key": "gitpod.io/workload_services",
                                            "operator": "In",
                                            "values": ["true"]
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            },
        });

        const doc = readYamlDocument(__dirname + '/assets/jaeger-gitpod.yaml');
        const gitpodJaeger = new KubernetesManifest(cluster.stack, "gitpod-jaeger", {
            cluster,
            overwrite: true,
            manifest: [loadYaml(doc)],
        });
        gitpodJaeger.node.addDependency(helmChart);
    }
}
