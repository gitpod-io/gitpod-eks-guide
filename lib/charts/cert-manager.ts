import cdk = require('@aws-cdk/core');
import * as iam from '@aws-cdk/aws-iam';
import { createNamespace, readYamlDocument, loadYaml } from './utils';
import { KubernetesManifest } from '@aws-cdk/aws-eks';
import { importCluster } from './cluster-utils';

export interface CertManagerProps extends cdk.StackProps {
    hostedZoneID?: string

    baseDomain?: string
    email?: string
}

export class CertManager extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: CertManagerProps) {
        super(scope, id);

        const cluster = importCluster(this, process.env.CLUSTER_NAME);

        const namespace = 'cert-manager';

        const ns = createNamespace(namespace, cluster);

        const serviceAccount = cluster.addServiceAccount('cert-manager', {
            name: 'cert-manager',
            namespace,
        });

        serviceAccount.node.addDependency(ns);

        const helmChart = cluster.addHelmChart('CertManagerChart', {
            chart: 'cert-manager',
            release: 'cert-manager',
            version: 'v1.6.0',
            repository: 'https://charts.jetstack.io/',
            namespace,
            createNamespace: false,
            wait: true,
            values: {
                installCRDs: true,
                serviceAccount: {
                    create: false,
                    name: serviceAccount.serviceAccountName,
                },
                securityContext: {
                    enabled: true,
                    fsGroup: 1001,
                },
                webhook: {
                    hostNetwork: true,
                    securePort: 10260
                },
            }
        });
        helmChart.node.addDependency(serviceAccount);

        // only create route53 issuer if the required fields are configured
        if (props.hostedZoneID) {
            if (!props.baseDomain) {
                throw new Error("Unexpected error: Missing baseDomain environment variable");
            }
            if (!props.email) {
                throw new Error("Unexpected error: Missing email environment variable");
            }

            serviceAccount.role.attachInlinePolicy(new iam.Policy(this, 'cert-manager-policy', {
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ['route53:GetChange'],
                        resources: ['arn:aws:route53:::change/*'],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ['route53:ChangeResourceRecordSets', 'route53:ListResourceRecordSets'],
                        resources: [`arn:aws:route53:::hostedzone/${props.hostedZoneID}`],
                    }),
                ],
            }));

            const doc = readYamlDocument(__dirname + '/assets/route53-issuer.yaml');
            const docArray = doc.
                replace(/{{email}}/g, props.email).
                replace(/{{baseDomain}}/g, props.baseDomain).
                replace(/{{hostedZoneID}}/g, props.hostedZoneID).
                replace(/{{region}}/g, cluster.stack.region).
                replace(/{{role}}/g, serviceAccount.role.roleArn);

            const issuerManifest = docArray.split("---").map(e => loadYaml(e));
            const certManagerIssuer = new KubernetesManifest(cluster.stack, "cert-manager-issuer", {
                cluster,
                overwrite: true,
                manifest: issuerManifest,
            });

            certManagerIssuer.node.addDependency(helmChart);
        }
    }
}
