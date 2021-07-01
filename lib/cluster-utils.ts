import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as eks from "@aws-cdk/aws-eks";
import * as ec2 from '@aws-cdk/aws-ec2';

export interface ImportCluster {
    vpc: ec2.IVpc
    clusterName: string
    clusterID: string

    clusterAdmin: iam.Role
}

export function importCluster(scope: cdk.Construct, props: ImportCluster): eks.ICluster {
    const oidcProviderArn = `arn:aws:iam::${props.vpc.stack.account}:oidc-provider/oidc.eks.${props.vpc.stack.region}.amazonaws.com/id/${props.clusterID}`;
    const openIdConnectProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(scope, "OpenIdConnectProvider", oidcProviderArn);

    return eks.Cluster.fromClusterAttributes(scope, props.clusterName, {
        clusterName: props.clusterName,
        vpc: props.vpc,
        openIdConnectProvider,
        kubectlRoleArn: props.clusterAdmin.roleArn,
    });
}
