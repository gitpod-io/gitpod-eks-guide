# Running Gitpod in [Amazon EKS](https://aws.amazon.com/es/eks/)

## Provision an EKS cluster

We provide two options to provision and install gitpod:

- Using a docker image
- Using a local script (requires the installation of dependencies)

For both options you need:

An AWS account with Administrator access: [create one now by clicking here](https://aws.amazon.com/getting-started/)

- A SSL Certificate created with [AWS Certificate Manager](https://aws.amazon.com/es/certificate-manager/)
- .env file with basic details about the environment. We provide an example of such file [here .env.example](.env.example)
- AWS credentials file. By default, such file is present in `$HOME/.aws/credentials`.
- [eksctl](https://eksctl.io/) configuration file describing the cluster. [Here eks-cluster.yaml](eks-cluster.yaml) you can find an example.


### Using a docker image

The requirements to install the cluster is [docker](https://docs.docker.com/engine/install/) and the configuration files previously mentioned.

**To start the installation run:**

```shell
make run
```

The whole process takes around forty minutes. In the end, the following resources are created:

- an EKS cluster running Kubernetes v1.20
- Kubernetes nodes using a custom [AMI image](https://github.com/aledbf/amazon-eks-custom-amis/tree/gitpod):
    - Ubuntu 20.04
    - Linux kernel 5.13
    - containerd 1.52
    - runc 1.0.0

- ALB load balancer with TLS termination and re-encryption
- RDS Mysql database
- Two autoscaling groups, one for gitpod components and another for workspaces
- In-cluster docker registry using S3 as storage backend
- IAM account with S3 access (docker-registry and gitpod user content)
- [calico](https://docs.projectcalico.org) as CNI and NetworkPolicy implementation
- [cert-manager](https://cert-manager.io/) for self-signed SSL certificates
- [cluster-autoscaler](https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler)
- [Jaeger operator](https://github.com/jaegertracing/helm-charts/tree/main/charts/jaeger-operator) - and Jaeger deployment for gitpod distributed tracing
- [metrics-server](https://github.com/kubernetes-sigs/metrics-server)
- [gitpod.io](https://github.com/gitpod-io/gitpod) deployment


## Using local scripts

### Prerequisites

For this guide, we need to download the official CLI for Amazon EKS [eksctl](https://github.com/weaveworks/eksctl) binary:
Confirm the eksctl command works running:

```shell
eksctl version
```
*be sure to install v0.54.0 or above*

Run the script `setup.sh <eksctl configuration>` passing as argument the path to the [eksctl](https://github.com/weaveworks/eksctl) configuration file.

We provide an example of such a configuration file as an example. The cluster

*Please adapt the configuration to the needs of your environment.*

```shell
setup.sh <eksctl configuration>
```

## Verify the installation

### Test gitpod workspace

When the provisioning and configuration of the cluster is done, the script shows the URL of the load balancer,
like:

```shell
Load balancer hostname: k8s-default-gitpod-.......elb.amazonaws.com
```

This is the value of the `CNAME` field that needs to be configured in the DNS domain, for the record `<domain>` and `*.<domain>`

After this two records are configured, please open the URL `<domain>/workspaces`. It should display the gitpod login page similar to


----

## Update gitpod auth providers

```shell
kubectl edit configmap auth-providers-config
```

TODO

## Destroy the cluster and AWS resources

Remove Cloudformation stacks created by CDK running:

```shell
cdk destroy --all
cdk context --clear
```

Delete the EKS cluster and all the resources

```shell
eksctl delete cluster <cluster name>
```
