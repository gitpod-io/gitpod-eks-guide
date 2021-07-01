
import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'

import { Database } from './database';
import { Registry } from './registry';
import { Gitpod } from './gitpod';
import { AccountRootPrincipal, ManagedPolicy, Role } from '@aws-cdk/aws-iam';
import { importCluster } from './cluster-utils';
import * as eks from '@aws-cdk/aws-eks';
import { AWSLoadBalancerController } from './load-balancer';
import { MetricsServer } from './metrics-server';
import { CertManager } from './cert-manager';
import { Jaeger } from './jaeger';
import { ContainerInsights } from './container-insights';
import { ClusterAutoscaler } from './cluster-autoscaler';

import * as path from "path";

export interface MainStackProps extends cdk.StackProps {
    clusterName: string
    domain: string
    identityoidcissuer: string
    certificateArn: string
}
export class MainApp extends cdk.Stack {

    constructor(scope: cdk.Construct, id: string, props: MainStackProps) {
        super(scope, id, props)

        // search VPC created by eksctl
        const vpc = ec2.Vpc.fromLookup(this, 'vpc', {
            vpcName: `eksctl-${props.clusterName}-cluster/VPC`,
        });

        // define a role one which is used for setup/maintainance
        const clusterAdmin = new Role(this, `${props.clusterName}-cluster-maintenance-role`, {
            assumedBy: new AccountRootPrincipal()
        });
        clusterAdmin.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'));
        clusterAdmin.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSServicePolicy'));

        const clusterID = path.basename(props.identityoidcissuer);

        // import cluster created with eksctl
        const cluster = importCluster(this, {
            clusterName: props.clusterName,
            clusterID,
            clusterAdmin,
            vpc,
        });

        this.configureContainerInsights(cluster);
        this.configureAutoscaler(props.clusterName, cluster);
        this.configureAWSLoadBalancerController(cluster);
        this.configureMetricsServer(cluster);
        this.configureCertManager(cluster);
        this.configureJaeger(cluster);

        // create RDS database for gitpod
        const database = new Database(this, 'RDS', {
            env: props.env,
            clusterName: props.clusterName,
            vpc,
            username: 'gitpod'
        })

        // create permissions to access S3 buckets
        const registry = new Registry(this, 'Registry', {
            env: props.env,
            clusterName: props.clusterName,
            bucketName: `container-registry-${props.clusterName}`,
        });

        const gitpod = new Gitpod(this, 'Deploy', {
            env: props.env,
            cluster,
            clusterName: props.clusterName,
            database,
            registry,
            domain: props.domain,
            certificateArn: props.certificateArn,
        });
        gitpod.addDependency(database);
        gitpod.addDependency(registry);
    }

    private configureAWSLoadBalancerController(cluster: eks.ICluster): void {
        new AWSLoadBalancerController(this, 'aws-load-balancer', {
            cluster
        });
    }

    private configureMetricsServer(cluster: eks.ICluster): void {
        new MetricsServer(this, 'metrics-server', {
            cluster
        });
    }

    private async configureCertManager(cluster: eks.ICluster) {
        new CertManager(this, 'cert-manager', {
            cluster,
            baseDomain: process.env.DOMAIN,
            email: process.env.LETSENCRYPT_EMAIL,
        });
    }

    private configureJaeger(cluster: eks.ICluster): void {
        new Jaeger(this, 'jaeger', {
            cluster
        });
    }

    private configureContainerInsights(cluster: eks.ICluster): void {
        new ContainerInsights(this, 'container-insights', {
            cluster,
        });
    }

    private configureAutoscaler(clusterName: string, cluster: eks.ICluster): void {
        new ClusterAutoscaler(this, 'cluster-autoscaler', {
            cluster,

            clusterName
        });
    }
}
