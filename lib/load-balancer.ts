import cdk = require('@aws-cdk/core');
import eks = require('@aws-cdk/aws-eks');

const AWS_LOAD_BALANCER_CONTROLLER = 'aws-load-balancer-controller';

export interface AWSLoadBalancerControllerProps extends cdk.StackProps {
    cluster: eks.ICluster;
}

export class AWSLoadBalancerController extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: AWSLoadBalancerControllerProps) {
        super(scope, id);

        const cluster = props.cluster;

        const helmChart = cluster.addHelmChart('AWSLoadBalancerControllerChart', {
            chart: AWS_LOAD_BALANCER_CONTROLLER,
            release: AWS_LOAD_BALANCER_CONTROLLER,
            repository: 'https://aws.github.io/eks-charts',
            namespace: 'kube-system',
            version: '1.2.2',
            wait: true,
            values: {
                clusterName: cluster.clusterName,
                serviceAccount: {
                    create: false,
                    name: AWS_LOAD_BALANCER_CONTROLLER,
                },
            },
        });
    }
}
