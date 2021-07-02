import * as path from "path";

import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as iam from '@aws-cdk/aws-iam';

export interface SetupProps extends cdk.StackProps {
    identityoidcissuer: string
}

export class SetupStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: SetupProps) {
        super(scope, id, props)

        // search VPC created by eksctl (validation purposes)
        ec2.Vpc.fromLookup(this, 'vpc', {
            vpcName: `eksctl-${process.env.CLUSTER_NAME}-cluster/VPC`,
        });

        // Extract the ID of the EKS cluster from the identityoidcissuer URL
        const clusterID = path.basename(props.identityoidcissuer);
        const oidcProviderArn = `arn:aws:iam::${process.env.ACCOUNT_ID}:oidc-provider/oidc.eks.${process.env.AWS_REGION}.amazonaws.com/id/${clusterID}`;
        const openIdConnectProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, "OpenIdConnectProvider", oidcProviderArn);

        new cdk.CfnOutput(this, "ClusterName", {
            value: `${process.env.CLUSTER_NAME}`, exportName: "ClusterName",
        });
        new cdk.CfnOutput(this, "OpenIdConnectProviderArn", {
            value: openIdConnectProvider.openIdConnectProviderArn,
            exportName: "OpenIdConnectProviderArn",
        });
    }
}
