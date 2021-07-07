.DEFAULT_GOAL:=help

# set default shell
SHELL=/bin/bash -o pipefail -o errexit

IMG=gitpod-eks

build: ## Build docker image containing the required tools for the installation
	@docker build --quiet . -t ${IMG}
	@mkdir -p ${PWD}/logs

DOCKER_RUN_CMD = docker run -it \
	--env-file ${PWD}/.env \
	--volume ${PWD}:/gitpod \
	--volume ${PWD}/logs:/root/.npm/_logs \
	--volume ${HOME}/.aws/credentials:/root/.aws/credentials \
	${IMG} $(1)

install: build ## Install gitpod
	@touch .kubeconfig
	@$(call DOCKER_RUN_CMD, --install)

uninstall: build ## Uninstall gitpod
	@mkdir -p ${PWD}/logs
	@$(call DOCKER_RUN_CMD, --uninstall)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.PHONY: build install uninstall help
