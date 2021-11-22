
PACKER_VARIABLES := binary_bucket_name binary_bucket_region eks_version eks_build_date root_volume_size data_volume_size hardening_flag http_proxy https_proxy no_proxy
VPC_ID := vpc-0e8cf1ce122b1b059
SUBNET_ID := subnet-0eddf1d7d0f9f9772
AWS_REGION := us-west-2
PACKER_FILE :=

EKS_BUILD_DATE := 2020-11-02
EKS_120_VERSION := 1.20.4
EKS_121_VERSION := 1.21.2

build:
	packer build \
		--var 'aws_region=$(AWS_REGION)' \
		$(foreach packerVar,$(PACKER_VARIABLES), $(if $($(packerVar)),--var $(packerVar)='$($(packerVar))',)) \
		$(PACKER_FILE)

# Ubuntu 21.10
#-----------------------------------------------------
# https://docs.aws.amazon.com/eks/latest/userguide/eks-optimized-ami.html

build-ubuntu2110-1.20:
	$(MAKE) build PACKER_FILE=amazon-eks-node-ubuntu2110.json eks_version=$(EKS_120_VERSION) eks_build_date=2021-04-12

build-ubuntu2110-1.21:
	$(MAKE) build PACKER_FILE=amazon-eks-node-ubuntu2110.json eks_version=$(EKS_121_VERSION) eks_build_date=2021-07-05
