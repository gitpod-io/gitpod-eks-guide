FROM alpine:edge

RUN apk add --no-cache \
    bash \
    curl \
    nodejs \
    python3 \
    py3-pip \
    yarn \
    jq \
    npm \
    yq \
    openssl \
  && pip3 install --upgrade pip \
  && pip3 install \
    awscli \
  && rm -rf /root/.cache

RUN curl -fsSL https://github.com/mikefarah/yq/releases/download/v4.12.0/yq_linux_amd64 -o /usr/local/bin/yq \
  && chmod +x /usr/local/bin/yq

RUN curl -fsSL https://github.com/weaveworks/eksctl/releases/download/v0.100.0/eksctl_Linux_amd64.tar.gz | tar -xz -C /usr/local/bin

RUN curl -fsSL "https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl" -o /usr/local/bin/kubectl \
  && chmod +x /usr/local/bin/kubectl

WORKDIR /gitpod

COPY . /gitpod

RUN yarn --pure-lockfile --non-interactive --ignore-scripts \
  && rm -rf /usr/local/share/.cache/yarn

RUN npm install -g --ignore-scripts aws-cdk ts-node

ENTRYPOINT ["/gitpod/setup.sh"]
