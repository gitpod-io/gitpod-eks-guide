import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';
import { SecretValue } from '@aws-cdk/core';
import * as ssm from '@aws-cdk/aws-ssm';

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

    constructor(scope: cdk.Construct, id: string, props: DatabaseProps) {
        super(scope, id, props);

        const rdsVersion = rds.MysqlEngineVersion.VER_5_7;
        const parameterGroup = new rds.ParameterGroup(this, "DBParameterGroup", {
            engine: props.instanceEngine ?? rds.DatabaseInstanceEngine.mysql({
                version: rdsVersion,
            }),
            parameters: {
                explicit_defaults_for_timestamp: "OFF"
            }
        });

        // TODO: remove when the gitpod helm chart supports using secrets from ssm
        this.credentials = ssm.StringParameter.valueForStringParameter(
            this, `/gitpod/cluster/${props.clusterName}/region/${props.vpc.stack.region}`);

        const instance = new rds.DatabaseInstance(this, 'Gitpod', {
            vpc: props.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_NAT },
            engine: props.instanceEngine ?? rds.DatabaseInstanceEngine.mysql({
                version: rdsVersion,
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

        new cdk.CfnOutput(this, "MysqlEndpoint", {
            value: instance.dbInstanceEndpointAddress,
            exportName: "MysqlEndpoint",
        });
        new cdk.CfnOutput(this, "MysqlUsername", {
            value: props.username,
            exportName: "MysqlUsername",
        });
        new cdk.CfnOutput(this, "MysqlPort", {
            value: '3306',
            exportName: "MysqlPort",
        });
    }
}
