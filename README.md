# Running Gitpod in [Amazon EKS](https://aws.amazon.com/en/eks/)

> **IMPORTANT** This guide exists as a simple and reliable way of creating required AWS infrastructure. It
> is not designed to cater for every situation. If you find that it does not meet your exact needs,
> please fork this guide and amend it to your own needs.

This guide exists as a simple and reliable way of creating an environment in AWS (EKS) that [Gitpod can
be installed](https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod) into.

## Provision an EKS cluster

Before starting the installation process, you need:

- An AWS account with Administrator access
  - [Create one now by clicking here](https://aws.amazon.com/getting-started/)
- AWS credentials set up. By default, those configs are present in `$HOME/.aws/`.
- [eksctl](https://eksctl.io/) config file describing the cluster.
  - Here is an [eks-cluster.yaml](eks-cluster.yaml) you can use as example.
- A `.env` file with basic details about the environment.
  - We provide an example of such file [here](.env.example).
- [Docker](https://docs.docker.com/engine/install/) installed on your machine, or better, a Gitpod workspace :)


**To start the installation, execute:**

```shell
make build
make install
```

**Important: DNS propagation can take several minutes until the configured domain is available!**

The whole process takes around forty minutes. In the end, the following resources are created:

- an EKS cluster running Kubernetes v1.21
- Kubernetes nodes using a custom [AMI image](https://github.com/gitpod-io/amazon-eks-custom-amis/tree/gitpod):
  - Ubuntu 21.10
  - Linux kernel v5.13
  - containerd v1.5.8
  - runc: v1.0.1
  - CNI plugins: v0.9.1
  - Stargz Snapshotter: v0.10.0

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
- A public DNS zone managed by Route53 (if `ROUTE53_ZONEID` env variable is configured)

## Post Install

Once this guide is ran to completion, The relevant configuration values are emitted to move forward with the
[Gitpod installation with kots](https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod).

### ALB and SSH Gateway 

You are free to use your own Ingress (thus ALB), and set up SSL termination (with AWS Cert Manager or similar things)
on the Load Balancer. But as ALB only supports L7 protocols, [SSH Gateway](https://github.com/gitpod-io/gitpod/blob/main/install/installer/docs/workspace-ssh-access.md)
does not work through it.

For this, A separate `LoadBalancer` service (and thus CLB) can be created (by using the below YAML) specifically
for `ssh` gateway, and it's external URL should be used for your `*.ssh.ws.<gitpod-domain>` DNS record.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ssh-gateway
  namespace: default
  labels:
    app: gitpod
    component: ws-proxy
    kind: service
spec:
  ports:
    - name: ssh
      protocol: TCP
      port: 22
      targetPort: 2200
  selector:
    app: gitpod
    component: ws-proxy
  type: LoadBalancer
```

## Destroy the cluster and AWS resources

Remove Cloudformation stacks and EKS cluster running:

```shell
make uninstall
```

> The command asks for a confirmation:
> `Are you sure you want to delete: Gitpod, Services/Registry, Services/RDS, Services, Addons, Setup (y/n)?`

> Please make sure you delete the S3 bucket used to store the docker registry images!
