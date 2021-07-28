import { importCluster } from './cluster-utils';
import cdk = require('@aws-cdk/core');

const AWS_LOAD_BALANCER_CONTROLLER = 'aws-load-balancer-controller';

export class AWSLoadBalancerController extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
        super(scope, id);

        const cluster = importCluster(this, process.env.CLUSTER_NAME);

        const helmChart = cluster.addHelmChart('AWSLoadBalancerControllerChart', {
            chart: AWS_LOAD_BALANCER_CONTROLLER,
            release: AWS_LOAD_BALANCER_CONTROLLER,
            repository: 'https://aws.github.io/eks-charts',
            namespace: 'kube-system',
            version: '1.2.3',
            wait: true,
            values: {
                replicaCount: 1,
                hostNetwork: true,
                clusterName: cluster.clusterName,
                serviceAccount: {
                    create: false,
                    name: AWS_LOAD_BALANCER_CONTROLLER,
                },
            },
        });
    }
}
