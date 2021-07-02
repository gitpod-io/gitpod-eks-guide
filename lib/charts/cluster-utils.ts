import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as eks from "@aws-cdk/aws-eks";

export function importCluster(scope: cdk.Construct, clusterName: string | undefined): eks.ICluster {
    if (clusterName == null) {
        throw new Error('Cluster Name is not defined.');
    }

    const oidcProviderArn = cdk.Fn.importValue("OpenIdConnectProviderArn");
    const openIdConnectProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
        scope, "OpenIdConnectProvider", oidcProviderArn);

    const kubectlRoleArn = cdk.Fn.importValue("KubectlRoleArn");
    return eks.Cluster.fromClusterAttributes(scope, "BaseCluster", {
        clusterName,
        openIdConnectProvider,
        kubectlRoleArn
    });
}
