import { KubernetesManifest } from '@aws-cdk/aws-eks';
import { loadYaml, readYamlDocument } from './utils';
import cdk = require('@aws-cdk/core');
import eks = require('@aws-cdk/aws-eks');

export interface JaegerProps extends cdk.StackProps {
    cluster: eks.ICluster;
}

export class Jaeger extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: JaegerProps) {
        super(scope, id);

        const helmChart = props.cluster.addHelmChart('jaeger-operator-chart', {
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
                                            "key": "purpose",
                                            "operator": "In",
                                            "values": ["services"]
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
        const gitpodJaeger = new KubernetesManifest(props.cluster.stack, "gitpod-jaeger", {
            cluster: props.cluster,
            overwrite: true,
            manifest: [loadYaml(doc)],
        });
        gitpodJaeger.node.addDependency(helmChart);
    }
}
