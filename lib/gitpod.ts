import {
    Construct,
    Stack,
    StackProps
} from '@aws-cdk/core';

import { ICluster, KubernetesManifest } from '@aws-cdk/aws-eks';

import { readYamlDocument, loadYaml, createNamespace } from './charts/utils';
import { importCluster } from './charts/cluster-utils';

export interface GitpodProps extends StackProps {
    domain: string
    certificateArn?: string
}

export class GitpodStack extends Stack {
    constructor(scope: Construct, id: string, props: GitpodProps) {
        super(scope, id, props);

        if (!process.env.CREATE_LB) {
            return;
        }

        const cluster = importCluster(this, process.env.CLUSTER_NAME);
        const namespace = process.env.NAMESPACE
        if (!namespace) {
            throw new Error('Namespace is not defined.');
        }

        const ns = createNamespace(namespace, cluster);

        this.createIngress(props, cluster, namespace);
        this.createSshGatewayService(props, cluster, namespace);
    }

    private createIngress(props: GitpodProps, cluster: ICluster, namespace: string) {
        const doc = readYamlDocument(__dirname + '/charts/assets/ingress.yaml');
        const manifest = loadYaml(doc) as any;

        // configure TLS termination in the load balancer
        if (props.certificateArn) {
            manifest.metadata.annotations['alb.ingress.kubernetes.io/certificate-arn'] = props.certificateArn;
            manifest.metadata.annotations['alb.ingress.kubernetes.io/ssl-policy'] = 'ELBSecurityPolicy-FS-1-2-Res-2020-10';
        }

        manifest.metadata.annotations['alb.ingress.kubernetes.io/load-balancer-name'] = `${process.env.CLUSTER_NAME}-${props.env?.region}`;

        // if we have a route53 zone ID, enable external-dns.
        if (process.env.ROUTE53_ZONEID) {
            manifest.metadata.annotations['external-dns.alpha.kubernetes.io/hostname'] = `${props.domain}, *.${props.domain}, *.ws.${props.domain}`;
        }

        if (process.env.USE_INTERNAL_ALB && process.env.USE_INTERNAL_ALB.toLowerCase() === 'true') {
            manifest.metadata.annotations['alb.ingress.kubernetes.io/scheme'] = 'internal';
        } else {
            manifest.metadata.annotations['alb.ingress.kubernetes.io/scheme'] = 'internet-facing';
        }

        if (process.env.ALB_SUBNETS) {
            manifest.metadata.annotations['alb.ingress.kubernetes.io/subnets'] = `${process.env.ALB_SUBNETS}`;
        }

        if (process.env.LB_INBOUND_CIDRS) {
            manifest.metadata.annotations['alb.ingress.kubernetes.io/inbound-cidrs'] = `${process.env.LB_INBOUND_CIDRS}`;
        }

        manifest.metadata.namespace = namespace;
        new KubernetesManifest(this, 'gitpod-ingress', {
            cluster,
            overwrite: true,
            manifest: [manifest],
        });
    }

    private createSshGatewayService(props: GitpodProps, cluster: ICluster, namespace: string) {
        const doc = readYamlDocument(__dirname + '/charts/assets/ssh-gateway.yaml');
        const manifest = loadYaml(doc) as any;

        // if we have a route53 zone ID, enable external-dns.
        if (process.env.ROUTE53_ZONEID) {
            manifest.metadata.annotations['external-dns.alpha.kubernetes.io/hostname'] = `*.ssh.ws.${props.domain}`;
        }

        if (process.env.LB_INBOUND_CIDRS) {
            manifest.metadata.annotations['service.beta.kubernetes.io/load-balancer-source-ranges'] = `${process.env.LB_INBOUND_CIDRS}`;
        }

        manifest.metadata.namespace = namespace;
        new KubernetesManifest(this, 'gitpod-svc-ssh-gateway', {
            cluster,
            overwrite: true,
            manifest: [manifest],
        });
    }
}
