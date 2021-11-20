import cdk = require('@aws-cdk/core');
import * as iam from '@aws-cdk/aws-iam';
import { createNamespace } from './utils';
import { importCluster } from './cluster-utils';

const EXTERNAL_DNS_NAMESPACE = "external-dns";

export class ExternalDNS extends cdk.Construct {

    constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
        super(scope, id);

        if (!process.env.ROUTE53_ZONEID) {
            return;
        }

        const cluster = importCluster(this, process.env.CLUSTER_NAME);

        const ns = createNamespace(EXTERNAL_DNS_NAMESPACE, cluster);

        const serviceAccount = cluster.addServiceAccount('external-dns', {
            name: 'external-dns',
            namespace: EXTERNAL_DNS_NAMESPACE,
        });
        serviceAccount.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['route53:ChangeResourceRecordSets'],
                resources: ['arn:aws:route53:::hostedzone/*'],
            }),
        );
        serviceAccount.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['route53:ListHostedZones', 'route53:ListResourceRecordSets'],
                resources: ['*'],
            }),
        );
        serviceAccount.node.addDependency(ns);

        const helmChart = cluster.addHelmChart('external-dns', {
            chart: 'external-dns',
            release: 'external-dns',
            repository: 'https://charts.bitnami.com/bitnami',
            namespace: EXTERNAL_DNS_NAMESPACE,
            version: '5.5.0',
            values: {
                podSecurityContext: {
                    fsGroup: 65534,
                    runAsUser: 0
                },
                logFormat: 'json',
                domainFilters: [],
                sources: ["ingress"],
                policy: "upsert-only",
                serviceAccount: {
                    create: false,
                    name: serviceAccount.serviceAccountName
                },
                provider: 'aws',
                aws: {
                    region: cluster.stack.region,
                    zoneType: "public",
                    preferCNAME: false,
                    evaluateTargetHealth: false,
                },
                txtOwnerId: process.env.ROUTE53_ZONEID
            }
        });

        helmChart.node.addDependency(serviceAccount);
    }
}
