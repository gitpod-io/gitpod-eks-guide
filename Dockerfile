FROM alpine:3.14

RUN apk add --no-cache \
    bash \
    curl \
    nodejs \
    python3 \
    py3-pip \
    yarn \
  && pip3 install --upgrade pip \
  && pip3 install \
    awscli

RUN aws --version

RUN curl -fsSL https://github.com/mikefarah/yq/releases/download/v4.9.6/yq_linux_amd64 -o /usr/local/bin/yq \
  && chmod +x /usr/local/bin/yq

RUN curl -fsSL https://github.com/weaveworks/eksctl/releases/download/0.55.0-rc.0/eksctl_Linux_amd64.tar.gz | tar -xz -C /usr/local/bin

RUN curl -fsSL "https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl" -o /usr/local/bin/kubectl \
  && chmod +x /usr/local/bin/kubectl

WORKDIR /gitpod

COPY . /gitpod

RUN yarn install

VOLUME [ "/gitpod" ]

CMD ["/bin/bash", "-c", "set -x /gitpod/setup.sh eks-cluster.yaml $DOMAIN $CERTIFICATE_ARN"]
