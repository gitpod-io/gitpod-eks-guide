# Running Gitpod in [Amazon EKS](https://aws.amazon.com/es/eks/)

## Provision an EKS cluster

Before starting the installation process, you need:

- An AWS account with Administrator access: [create one now by clicking here](https://aws.amazon.com/getting-started/)
- A SSL Certificate created with [AWS Certificate Manager](https://aws.amazon.com/es/certificate-manager/)
- .env file with basic details about the environment. We provide an example of such file [here .env.example](.env.example)
- AWS credentials file. By default, such a file is present in `$HOME/.aws/credentials`.
- [eksctl](https://eksctl.io/) configuration file describing the cluster. [Here eks-cluster.yaml](eks-cluster.yaml) you can find an example.
- [docker](https://docs.docker.com/engine/install/) installed on your machine, or better, a gitpod workspace :)

**To start the installation, execute:**

```shell
make install
```

The whole process takes around forty minutes. In the end, the following resources are created:

- an EKS cluster running Kubernetes v1.20
- Kubernetes nodes using a custom [AMI image](https://github.com/gitpod-io/amazon-eks-custom-amis/tree/gitpod):
   - Ubuntu 20.04
   - Linux kernel v5.13
   - containerd v1.52
   - runc v1.0.0

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


## Verify the installation

First, check that gitpod components are running.

```shell
kubectl get pods
NAME                               READY   STATUS    RESTARTS   AGE
blobserve-6bdb9c7f89-lvhxd         2/2     Running   0          6m17s
content-service-59bd58bc4d-xgv48   1/1     Running   0          6m17s
dashboard-6ffdf8984-b6f7j          1/1     Running   0          6m17s
image-builder-5df5694848-wsdvk     3/3     Running   0          6m16s
jaeger-8679bf6676-zz57m            1/1     Running   0          4h28m
messagebus-0                       1/1     Running   0          4h11m
proxy-56c4cdd799-bbfbx             1/1     Running   0          5m33s
registry-6b75f99844-bhhqd          1/1     Running   0          4h11m
registry-facade-f7twj              2/2     Running   0          6m12s
server-64f9cf6b9b-bllgg            2/2     Running   0          6m16s
ws-daemon-bh6h6                    2/2     Running   0          2m47s
ws-manager-5d57746845-t74n5        2/2     Running   0          6m16s
ws-manager-bridge-79f7fcb5-7w4p5   1/1     Running   0          6m16s
ws-proxy-7fc9665-rchr9             1/1     Running   0          5m57s
```

TODO: add additional `kubectl log` commands

### Test gitpod workspace

When the provisioning and configuration of the cluster is done, the script shows the URL of the load balancer,
like:

```shell
Load balancer hostname: k8s-default-gitpod-.......elb.amazonaws.com
```

This is the value of the `CNAME` field that needs to be configured in the DNS domain, for the record `<domain>`, `*.ws.<domain>` and `*.<domain>`

After these two records are configured, please open the URL `https://<domain>/workspaces`.
It should display the gitpod login page similar to the next image.

![gitpod login page](./images/gitpod-login.png "gitpod Login Page")

----

## Update gitpod auth providers

```shell
kubectl edit configmap auth-providers-config
```

TODO: instructions to set up providers. Idea: mount secret with auth providers

## Destroy the cluster and AWS resources

Before running any `cdk` command, please make sure to empty the S3 bucket created during the provisioning; otherwise, the deletion will fail (security measure)

Remove Cloudformation stacks created by CDK running:

```shell
cdk destroy --all
cdk context --clear
```

Delete the EKS cluster and cloud resources running:

```shell
eksctl delete cluster <cluster name>
```

> By default CDK creates a local file [cdk.context.json](https://docs.aws.amazon.com/cdk/latest/guide/context.html) as a cache of values retrieved from your AWS account.
> Please make sure you delete the file after you destroy the cluster.
