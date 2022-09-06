
 ## 📣 [IMPORTANT] This repo is being deprecated in favor of the [single cluster reference architecture](https://www.gitpod.io/docs/self-hosted/latest/reference-architecture/single-cluster-ref-arch) and the corresponding [Terraform config](https://github.com/gitpod-io/gitpod/tree/main/install/infra/single-cluster/aws).

**What?** 

We are deprecating this guide in favor of our [reference architectures](https://www.gitpod.io/docs/self-hosted/latest/reference-architecture) (specifically the [single cluster variant](https://www.gitpod.io/docs/self-hosted/latest/reference-architecture/single-cluster-ref-arch)) that include both a guided walk-through and a `Terraform` configuration.

**Why?**

From your feedback, we’ve learned that the guide has several shortcomings:

- It is not obvious what the guide does: it is more a black box than a sensible starting point for creating the infrastructure that works for you.
- One size fits all: it was not flexible enough if you wish to customize the infrastructure being created.
- No incremental upgrades: If a version of a component changes, you’d have to recreate the infrastructure.

Due to the feedback above we’ve decided to move to a more open and industry-standard way of speaking about the recommended infrastructure in the form of our new [reference architectures](https://www.gitpod.io/docs/self-hosted/latest/reference-architecture/single-cluster-ref-arch). These are descriptions of what the ideal infrastructure for Gitpod looks like depending on your circumstances. They include both a text version as well as a Terraform configuration that helps you create this infrastructure automatically - similarly to this guide. We believe these provide the following benefits: 

- They are based on a popular `Infrastructure as Code (IaC)` solution (`Terraform`), which should facilitate maintenance for you (and us) via features such as incremental upgrades.
- They are easier to parse, as they are configuration files rather than a script. This should make customizations easier.
- They provide a detailed walkthrough for those that do not want to use Terraform.
- We already leverage these in our nightly testing to provide further validation and reliability of them when used to run Gitpod.

**Impact?**

Going forward, Gitpod will only officially support the [reference architectures](https://www.gitpod.io/docs/self-hosted/latest/reference-architecture/single-cluster-ref-arch). If you can, we would advise you to switch towards using these - this would require you to recreate your infrastructure using the new Terraform configurations or guide. Staying on infrastructure created by this guide *should* work going forward, however, we cannot guarantee this in perpetuity.

—> The Reference Architectures are still in `beta` or `alpha` while we gather more feedback. Please do reach out to us on Discord or via [support](https://www.gitpod.io/support) with any problems or feedback.

------
## Running Gitpod in [Amazon EKS](https://aws.amazon.com/en/eks/)

> **IMPORTANT** This guide exists as a simple and reliable way of creating required AWS infrastructure. It
> is not designed to cater for every situation. If you find that it does not meet your exact needs,
> please fork this guide and amend it to your own needs.

This guide exists as a simple and reliable way of creating an environment in AWS (EKS) that [Gitpod can
be installed](https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod) into. Upon completion, it will print the config for the resources created (including passwords) and create the necessary credential files that will allow you to connect the components created to your Gitpod instance during the [next installation step](https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod).

### Provision an EKS cluster

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
- Kubernetes nodes using the [Ubuntu2004 EKS image](https://docs.aws.amazon.com/eks/latest/userguide/eks-partner-amis.html)

- RDS Mysql database
- Two autoscaling groups, one for gitpod components and another for workspaces
- In-cluster docker registry using S3 as storage backend
- IAM account with S3 access (docker-registry and gitpod user content)
- [calico](https://docs.projectcalico.org) as CNI and NetworkPolicy implementation
- [cert-manager](https://cert-manager.io/) for self-signed SSL certificates
- [cluster-autoscaler](https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler)
- [Jaeger operator](https://github.com/jaegertracing/helm-charts/tree/main/charts/jaeger-operator) - and Jaeger deployment for gitpod distributed tracing
- [metrics-server](https://github.com/kubernetes-sigs/metrics-server)
- a Let's Encrypt certificate issuer with automatic Route 53 DNS-01 challenges (if `ROUTE53_ZONEID` and `LETSENCRYPT_EMAIL` env variables are configured)
- an Application LoadBalancer (ALB) backed 'ingress' K8S resource with automatic Route 53 DNS and AWS ACM SSL certificate (if `CREATE_LB`, `ROUTE53_ZONEID` and `CERTIFICATE_ARN` env variables are configured)
- a Network LoadBalancer (NLB) backed 'service' K8S resource with automatic Route 53 DNS for Remote SSH Workspace Access (if `CREATE_LB` and `ROUTE53_ZONEID` env variables are configured)

## Post Install

Once this guide is ran to completion, The relevant configuration values are emitted to move forward with the
[Gitpod installation with kots](https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod).

### ALB and SSH Gateway

***
**Important**: Please ignore the following section if you have the `CREATE_LB` env variable set to `true`. The guide will create load balancers for you.

In this case, we just need to let the Gitpod installer know that we use our own Load Balancers, so it will not create its internal 'proxy' component as an AWS Classic LoadBalancer, but use `NodePort` type that works well with our external ALB & NLB load-balancers.

Simply upload the provided `extra-config-patch.yaml` configuration file to KOTS within the "Additional Options" configuration section using the "Gitpod config patch (YAML file)" file input field.
***

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

## Update Gitpod auth providers

Please check the [OAuth providers integration documentation](https://www.gitpod.io/docs/self-hosted/latest/configuration/authentication) expected format.

We provide an [example here](./auth-providers-patch.yaml). Fill it with your OAuth providers data.

```console
make auth
```

## Destroy the cluster and AWS resources

Remove Cloudformation stacks and EKS cluster running:

```shell
make uninstall
```

> The command asks for a confirmation:
> `Are you sure you want to delete: Gitpod, Services/Registry, Services/RDS, Services, Addons, Setup (y/n)?`

> Please make sure you delete the S3 bucket used to store the docker registry images!
