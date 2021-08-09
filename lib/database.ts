import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';
import { SecretValue } from '@aws-cdk/core';
import * as ssm from '@aws-cdk/aws-ssm';
import { ParameterGroup } from '@aws-cdk/aws-rds';

export interface DatabaseProps extends cdk.StackProps {
    readonly clusterName: string;
    readonly vpc: ec2.IVpc;
    readonly databaseSubnets?: ec2.SubnetSelection;
    readonly instanceType?: ec2.InstanceType;
    readonly instanceEngine?: rds.IInstanceEngine;
    readonly backupRetention?: cdk.Duration;
    readonly username: string;
}

export class Database extends cdk.Stack {
    readonly credentials: string
    readonly endpoint: string
    readonly username: string
    readonly port: string
    readonly database: string
    readonly region: string

    constructor(scope: cdk.Construct, id: string, props: DatabaseProps) {
        super(scope, id, props);

        const parameterGroup = new rds.ParameterGroup(this, "DBParameterGroup", {
            engine: props.instanceEngine ?? rds.DatabaseInstanceEngine.mysql({
                version: rds.MysqlEngineVersion.VER_5_7,
            }),
            parameters: {
                explicit_defaults_for_timestamp: "OFF"
            }
        });

        // TODO: remove when the gitpod helm chart supports using secrets from ssm
        this.credentials = ssm.StringParameter.valueForStringParameter(
            this, `/gitpod/cluster/${props.clusterName}/region/${props.vpc.stack.region}`, 1);

        const instance = new rds.DatabaseInstance(this, 'Gitpod', {
            vpc: props.vpc,
            vpcPlacement: { subnetType: ec2.SubnetType.PRIVATE },
            engine: props.instanceEngine ?? rds.DatabaseInstanceEngine.mysql({
                version: rds.MysqlEngineVersion.VER_5_7,
            }),
            storageEncrypted: true,
            backupRetention: props.backupRetention ?? cdk.Duration.days(7),
            credentials: rds.Credentials.fromPassword(props.username, SecretValue.plainText(this.credentials)),
            instanceType: props.instanceType ?? ec2.InstanceType.of(
                ec2.InstanceClass.T3,
                ec2.InstanceSize.MEDIUM,
            ),
            allocatedStorage: 10,
            // Enable multiAz for production
            multiAz: false,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            databaseName: 'gitpod',
            autoMinorVersionUpgrade: false,
            deletionProtection: false,
            parameterGroup
        });

        // allow internally from the same security group
        instance.connections.allowInternally(ec2.Port.tcp(3306));
        // allow from the whole vpc cidr
        instance.connections.allowFrom(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(3306));

        this.endpoint = instance.dbInstanceEndpointAddress;
        this.username = props.username;
        this.port = '3306';
        this.database = 'gitpod';
        this.region = props.vpc.stack.region;
    }
}
