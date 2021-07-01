# Running Gitpod in [Amazon EKS](https://aws.amazon.com/es/eks/)

## Provision an EKS cluster

We provide two options to provision and install gitpod:

- Using a docker image
- Using a local script (requires the installation of dependencies)

### Using a docker image

The only requirement is [docker](https://docs.docker.com/engine/install/) and two configuration files:

- .env file with basic details about the environment. We provide an example of such file [here .env.example](.env.example)
- AWS credentials file. By default, such file is present in `$HOME/.aws/credentials`.
- [eksctl](https://github.com/weaveworks/eksctl) configuration file describing the cluster we want to create. [Here eks-cluster.yaml](eks-cluster.yaml) you can find an example.

*Please adapt the configurations to the needs of your environment.*


**To start the installation run:**

```shell
# builds a docker image
make build

make run
```

The hole process takes forty minutes. At the end it provisions:

- an EKS cluster running Kubernetes v1.20.4
- custom [AMI image](https://github.com/aledbf/amazon-eks-custom-amis/tree/gitpod):
    - Ubuntu 20.04
    - Linux kernel 5.13
    - containerd 1.52
    - runc 1.0.0
    -
- two autoscaling groups, one for gitpod components and another for workspaces
- Local docker registry using S3 as storage backend
- ALB load balancer with TLS termination and re-encryption
- RDS Mysql database
- IAM account with S3 access (docker-registry and gitpod user content)
- [calico](https://docs.projectcalico.org) as CNI and network policy provider
- [cert-manager](https://cert-manager.io/) for seld-signed SSL certificates
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

Run the script `setup.sh <eksctl configuration> <domain> <AWS certificate ARN>` passing as argument the path to the [eksctl](https://github.com/weaveworks/eksctl) configuration file.

We provide an example of such configuration file as an example. The cluster

*Please adapt the configuration to the needs of your environment.*

```shell
setup.sh <eksctl configuration> <domain> <AWS certificate ARN>
```

## Verify install

TODO:

## Test gitpod workspace

TODO:

----

TODO: remove

**Create gitpod-sessions database**

```shell
kubectl run -it --rm --image=mysql:5.7 --restart=Never mysql-client -- mysql -h <hostname> -p<password> -u gitpod
```
