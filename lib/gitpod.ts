import cdk = require('@aws-cdk/core');
import { KubernetesManifest } from '@aws-cdk/aws-eks';

import { readYamlDocument, loadYaml } from './charts/utils';
import { Database } from './database';
import { Registry } from './registry';
import { importCluster } from './charts/cluster-utils';

// TODO: switch to official gitpod.io build
const version = "aledbf-retag.19";

export interface GitpodProps extends cdk.StackProps {
    domain: string

    certificateArn?: string

    database: Database
    registry: Registry
}

export class GitpodStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: GitpodProps) {
        super(scope, id, props);

        const cluster = importCluster(this, process.env.CLUSTER_NAME);

        let doc = readYamlDocument(__dirname + '/charts/assets/gitpod-values.yaml');
        doc = doc.
            replace(/{{version}}/g, version).

            replace(/{{domain}}/g, props.domain).

            replace(/{{region}}/g, props.env?.region || 'us-west-2').

            replace(/{{mysqlHostname}}/g, props.database.endpoint).
            replace(/{{mysqlPort}}/g, props.database.port).
            replace(/{{mysqlPassword}}/g, props.database.credentials).

            replace(/{{accessKey}}/g, props.registry.accessKey).
            replace(/{{secretKey}}/g, props.registry.secretKey).
            replace(/{{storageBucketName}}/g, props.registry.bucketName).

            replace(/{{issuerName}}/g, 'ca-issuer');

        const helmChart = cluster.addHelmChart('GitpodChart', {
            chart: 'gitpod',
            release: 'gitpod',
            repository: 'https://aledbf.github.io/gitpod-chart-cleanup/',
            namespace: 'default',
            version: '1.0.31',
            wait: true,
            values: loadYaml(doc),
        });

        doc = readYamlDocument(__dirname + '/charts/assets/ingress.yaml');
        const manifest = loadYaml(doc) as any;

        // configure TLS termination in the load balancer
        if (props.certificateArn) {
            manifest.metadata.annotations["alb.ingress.kubernetes.io/certificate-arn"] = props.certificateArn;
            manifest.metadata.annotations["alb.ingress.kubernetes.io/ssl-policy"] = "ELBSecurityPolicy-FS-1-2-Res-2020-10";
        }

        // if we have a route53 zone ID, enable external-dns.
        if (process.env.ROUTE53_ZONEID) {
            manifest.metadata.annotations["external-dns.alpha.kubernetes.io/hostname"] = `${props.domain}, *.${props.domain}, *.ws.${props.domain}`;
        }

        const gitpodIngress = new KubernetesManifest(this, "gitpod-ingress", {
            cluster,
            overwrite: true,
            manifest: [manifest],
        });
        gitpodIngress.node.addDependency(helmChart);
    }
}
