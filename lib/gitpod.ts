import cdk = require('@aws-cdk/core');
import { readYamlDocument, loadYaml } from './utils';
import { Database } from './database';
import { Registry } from './registry';
import * as eks from '@aws-cdk/aws-eks';
import { KubernetesManifest } from '@aws-cdk/aws-eks';

const version = "0.0.0";

export interface GitpodProps extends cdk.StackProps {
    cluster: eks.ICluster
    clusterName: string

    domain: string

    certificateArn?: string

    database: Database
    registry: Registry
}

export class Gitpod extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: GitpodProps) {
        super(scope, id, props);

        let doc = readYamlDocument(__dirname + '/assets/gitpod-values.yaml');
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

        const helmChart = props.cluster.addHelmChart('GitpodChart', {
            chart: 'gitpod',
            release: 'gitpod',
            repository: 'https://charts.gitpod.io',
            namespace: 'default',
            version: '0.10.0',
            wait: true,
            values: loadYaml(doc),
        });

        doc = readYamlDocument(__dirname + '/assets/ingress.yaml');
        const manifest = loadYaml(doc) as any;

        // configure TLS termination in the load balancer
        if (props.certificateArn) {
            manifest.metadata.annotations["alb.ingress.kubernetes.io/certificate-arn"] = props.certificateArn;
            manifest.metadata.annotations["alb.ingress.kubernetes.io/ssl-policy"] = "ELBSecurityPolicy-FS-1-2-Res-2020-10";
        }

        const gitpodIngress = new KubernetesManifest(props.cluster.stack, "gitpod-ingress", {
            cluster: props.cluster,
            overwrite: true,
            manifest: [manifest],
        });
        gitpodIngress.node.addDependency(helmChart);
    }
}
