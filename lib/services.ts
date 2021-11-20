
import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'

import { Database } from './database';
import { Registry } from './registry';

export class ServicesStack extends cdk.Stack {
    //readonly database: Database
    //readonly registry: Registry

    constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props)

        // search VPC created by eksctl
        const vpc = ec2.Vpc.fromLookup(this, 'vpc', {
            vpcName: `eksctl-${process.env.CLUSTER_NAME}-cluster/VPC`,
            isDefault: false
        });
        /*
        // create RDS database for gitpod
        this.database = new Database(this, 'RDS', {
            env: props.env,
            clusterName: `${process.env.CLUSTER_NAME}`,
            vpc,
            username: 'gitpod'
        })
        this.database.node.addDependency(vpc);
        */
        // create permissions to access S3 buckets
        /*
        this.registry = new Registry(this, 'Registry', {
            env: props.env,
            clusterName: `${process.env.CLUSTER_NAME}`,
            bucketName: `${process.env.CONTAINER_REGISTRY_BUCKET}`,
            createBucket: process.env.CREATE_S3_BUCKET === 'true',
        });
        */
    }
}
