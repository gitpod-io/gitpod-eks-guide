
IMG = "gitpod-eks"

build:
	@docker build . -t ${IMG}

run:
	@docker run -it \
		--env-file ${PWD}/.env \
		--volume ${PWD}:/gitpod \
		--volume ${HOME}/.aws/credentials:/root/.aws/credentials \
		${IMG}
