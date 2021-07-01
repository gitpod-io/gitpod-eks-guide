import cdk = require('@aws-cdk/core');
import eks = require('@aws-cdk/aws-eks');
import { createNamespace, readYamlDocument, loadYaml } from './utils';
import { KubernetesManifest } from '@aws-cdk/aws-eks';

export interface CertManagerProps extends cdk.StackProps {
    cluster: eks.ICluster

    hostedZoneID?: string

    baseDomain?: string
    email?: string
}

export class CertManager extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: CertManagerProps) {
        super(scope, id);

        const namespace = 'cert-manager';

        const ns = createNamespace(namespace, props.cluster);

        const serviceAccount = props.cluster.addServiceAccount('cert-manager', {
            name: 'cert-manager',
            namespace,
        });
        serviceAccount.node.addDependency(ns);

        const helmChart = props.cluster.addHelmChart('CertManagerChart', {
            chart: 'cert-manager',
            release: 'cert-manager',
            version: 'v1.4.0',
            repository: 'https://charts.jetstack.io/',
            namespace,
            createNamespace: false,
            wait: true,
            values: {
                installCRDs: true,
                serviceAccountName: serviceAccount.serviceAccountName,
                serviceAccount: {
                    create: false,
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

            const doc = readYamlDocument(__dirname + '/assets/route53-issuer.yaml');
            const docArray = doc.
                replace(/{{email}}/g, props.email).
                replace(/{{baseDomain}}/g, props.baseDomain).
                replace(/{{hostedZoneID}}/g, props.hostedZoneID).
                replace(/{{region}}/g, props.cluster.stack.region);

            const issuerManifest = docArray.split("---").map(e => loadYaml(e));
            const certManagerIssuer = new KubernetesManifest(props.cluster.stack, "cert-manager-issuer", {
                cluster: props.cluster,
                overwrite: true,
                manifest: issuerManifest,
            });

            certManagerIssuer.node.addDependency(helmChart);
        }
    }
}
