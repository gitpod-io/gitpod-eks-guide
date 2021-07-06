
import * as cdk from '@aws-cdk/core'

import { AWSLoadBalancerController } from './charts/load-balancer';
import { MetricsServer } from './charts/metrics-server';
import { CertManager } from './charts/cert-manager';
import { Jaeger } from './charts/jaeger';
import { ContainerInsights } from './charts/container-insights';
import { ClusterAutoscaler } from './charts/cluster-autoscaler';
import { ExternalDNS } from './charts/external-dns';

export class AddonsStack extends cdk.Stack {

    constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props)

        new ContainerInsights(this, 'container-insights', {});
        new ClusterAutoscaler(this, 'cluster-autoscaler', {});
        new AWSLoadBalancerController(this, 'aws-load-balancer', {});
        new MetricsServer(this, 'metrics-server', {});
        new CertManager(this, 'cert-manager', {
            baseDomain: process.env.DOMAIN,
            email: process.env.LETSENCRYPT_EMAIL,
        });
        new Jaeger(this, 'jaeger', {});
        new ExternalDNS(this, 'external-dns',{});
    }
}
