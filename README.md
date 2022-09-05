
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

### SSL Certificate

Create a public SSL/TLS certificate with [AWS Certificate Manager](https://aws.amazon.com/en/certificate-manager/),
valid for the `<domain>`, `*.ws.<domain>` and `*.<domain>` Domain names.

Once the certificate is issued and verified, Update the `CERTIFICATE_ARN` field in the `.env` file accordingly.

### Choose an Amazon Machine Image (AMI)

Please update the `ami` field in the [eks-cluster.yaml](eks-cluster.yaml) file with the proper AMI ID for the region of the cluster.

| Region       | AMI                   |
| ------------ | --------------------- |
| us-west-1    | ami-04e9afc0a981cac90 |
| us-west-2    | ami-009935ddbb32a7f3c |
| eu-west-1    | ami-0f08b4b1a4fd3ebe3 |
| eu-west-2    | ami-05f027fd3d0187541 |
| eu-central-1 | ami-04a8127c830f27712 |
| us-east-1    | ami-076db8ca29c04327b |
| us-east-2    | ami-0ad574da759c55c17 |

**To start the installation, execute:**

```shell
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
- A public DNS zone managed by Route53 (if `ROUTE53_ZONEID` env variable is configured)


## Update Gitpod auth providers

Please check the [OAuth providers integration documentation](https://www.gitpod.io/docs/self-hosted/latest/configuration/authentication) expected format.

We provide an [example here](./auth-providers-patch.yaml). Fill it with your OAuth providers data.

```console
make auth
```

> We are aware of the limitation of this approach, and we are working to improve the helm chart to avoid this step.

## Destroy the cluster and AWS resources

Remove Cloudformation stacks and EKS cluster running:

```shell
make uninstall
```

> The command asks for a confirmation:
> `Are you sure you want to delete: Gitpod, Services/Registry, Services/RDS, Services, Addons, Setup (y/n)?`

> Please make sure you delete the S3 bucket used to store the docker registry images!
