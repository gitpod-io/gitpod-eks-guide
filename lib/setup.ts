
import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'

import { AccountRootPrincipal, ManagedPolicy, Role } from '@aws-cdk/aws-iam';

import * as path from "path";
import * as iam from '@aws-cdk/aws-iam';

export interface SetupProps extends cdk.StackProps {
    identityoidcissuer: string
}

export class SetupStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: SetupProps) {
        super(scope, id, props)

        const clusterName = process.env.CLUSTER_NAME;

        // search VPC created by eksctl
        const vpc = ec2.Vpc.fromLookup(this, 'vpc', {
            vpcName: `eksctl-${clusterName}-cluster/VPC`,
        });

        // define a role one which is used for setup/maintainance
        const clusterAdmin = new Role(this, `${clusterName}-cluster-maintenance-role`, {
            assumedBy: new AccountRootPrincipal()
        });
        clusterAdmin.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'));
        clusterAdmin.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSServicePolicy'));

        const clusterID = path.basename(props.identityoidcissuer);
        const oidcProviderArn = `arn:aws:iam::${vpc.stack.account}:oidc-provider/oidc.eks.${vpc.stack.region}.amazonaws.com/id/${clusterID}`;

        const openIdConnectProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
            this, "OpenIdConnectProvider", oidcProviderArn);

        new cdk.CfnOutput(this, "ClusterName", {
            value: `${clusterName}`, exportName: "ClusterName",
        });

        new cdk.CfnOutput(this, "OpenIdConnectProviderArn", {
            value: openIdConnectProvider.openIdConnectProviderArn,
            exportName: "OpenIdConnectProviderArn",
        });

        new cdk.CfnOutput(this, "KubectlRoleArn", {
            value: clusterAdmin.roleArn,
            exportName: "KubectlRoleArn",
        });
    }
}
