import {
    Construct,
    Stack,
    StackProps
} from '@aws-cdk/core';

import { KubernetesManifest } from '@aws-cdk/aws-eks';

import { readYamlDocument, loadYaml } from './charts/utils';
import { importCluster } from './charts/cluster-utils';

export interface GitpodProps extends StackProps {
    domain: string

    certificateArn?: string
}

export class GitpodStack extends Stack {
    constructor(scope: Construct, id: string, props: GitpodProps) {
        super(scope, id, props);

        const cluster = importCluster(this, process.env.CLUSTER_NAME);

        const doc = readYamlDocument(__dirname + '/charts/assets/ingress.yaml');
        const manifest = loadYaml(doc) as any;

        // configure TLS termination in the load balancer
        if (props.certificateArn) {
            manifest.metadata.annotations["alb.ingress.kubernetes.io/certificate-arn"] = props.certificateArn;
            manifest.metadata.annotations["alb.ingress.kubernetes.io/ssl-policy"] = "ELBSecurityPolicy-FS-1-2-Res-2020-10";
        }

        manifest.metadata.annotations["alb.ingress.kubernetes.io/load-balancer-name"] = `${process.env.CLUSTER_NAME}-${props.env?.region}`;

        // if we have a route53 zone ID, enable external-dns.
        if (process.env.ROUTE53_ZONEID) {
            manifest.metadata.annotations["external-dns.alpha.kubernetes.io/hostname"] = `${props.domain}, *.${props.domain}, *.ws.${props.domain}`;
        }

        if (process.env.USE_INTERNAL_ALB && process.env.USE_INTERNAL_ALB.toLowerCase() === 'true') {
            manifest.metadata.annotations["alb.ingress.kubernetes.io/scheme"] = 'internal';
        } else {
            manifest.metadata.annotations["alb.ingress.kubernetes.io/scheme"] = 'internet-facing';
        }

        if (process.env.ALB_SUBNETS) {
            manifest.metadata.annotations["alb.ingress.kubernetes.io/subnets"] = `${process.env.ALB_SUBNETS}`;
        }

        const gitpodIngress = new KubernetesManifest(this, "gitpod-ingress", {
            cluster,
            overwrite: true,
            manifest: [manifest],
        });
    }
}
