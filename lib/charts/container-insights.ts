import * as cdk from "@aws-cdk/core";
import * as eks from "@aws-cdk/aws-eks";
import * as iam from '@aws-cdk/aws-iam';
import { LogGroup, RetentionDays, ILogGroup } from '@aws-cdk/aws-logs';
import { importCluster } from './cluster-utils';
import { RemovalPolicy } from '@aws-cdk/core';
import { ServiceAccount } from "@aws-cdk/aws-eks";
import { ManagedPolicy } from '@aws-cdk/aws-iam';

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
            version: '0.1.16',
            values: {
                serviceAccount: {
                    create: false,
                    name: serviceAccount.serviceAccountName,
                },
                cloudWatch: this.parseCloudWatchOptions(`${process.env.AWS_REGION}`, serviceAccount),
                elasticsearch: {
                    enabled: false
                },
                kinesis: {
                    enabled: false
                },
                firehose: {
                    enabled: false
                },
            }
        });
        helmChart.node.addDependency(serviceAccount);
    }

    private parseCloudWatchOptions(region: string, serviceAccount: ServiceAccount): Record<string, unknown> {
        const logGroup = new LogGroup(this, 'AwsForFluentBitAddonDefaultLogGroup', {
            logGroupName: `/aws/eks/fluentbit/${process.env.CLUSTER_NAME}`,
            removalPolicy: RemovalPolicy.DESTROY,
            retention: RetentionDays.ONE_MONTH,
        });

        serviceAccount.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'));

        return {
            enabled: true,
            region,
            logGroupName: logGroup.logGroupName,
            match: '*',
            autoCreateGroup: false,
        };
    }
}
