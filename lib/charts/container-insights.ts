import * as cdk from "@aws-cdk/core";
import * as eks from "@aws-cdk/aws-eks";
import * as iam from '@aws-cdk/aws-iam';
import { importCluster } from './cluster-utils';

export class ContainerInsights extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
        super(scope, id);

        const cluster = importCluster(this, process.env.CLUSTER_NAME);

        const namespace = 'kube-system';

        const serviceAccount = new eks.ServiceAccount(this, 'fluent-bit', {
            cluster,
            name: 'fluent-bit',
            namespace,
        });
        serviceAccount.role.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
        );

        const helmChart = cluster.addHelmChart('aws-for-fluent-bit', {
            chart: 'aws-for-fluent-bit',
            release: 'aws-for-fluent-bit',
            repository: 'https://aws.github.io/eks-charts',
            namespace,
            version: '0.1.11',
            values: {
                serviceAccount: {
                    create: false,
                    name: serviceAccount.serviceAccountName,
                },
                cloudWatch: {
                    region: cluster.stack.region,
                },
                firehose: {
                    enabled: false
                },
                kinesis: {
                    enabled: false
                },
                elasticsearch: {
                    enabled: false
                }
            }
        });
        helmChart.node.addDependency(serviceAccount);
    }
}
