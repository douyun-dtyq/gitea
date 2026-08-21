# syntax=docker/dockerfile:1
# Build frontend on the native platform to avoid QEMU-related issues with nodejs ecosystem

ARG GOLANG_VERSION=1.27
ARG ALPINE_VERSION=3.24

FROM --platform=$BUILDPLATFORM docker.io/library/golang:${GOLANG_VERSION}-alpine${ALPINE_VERSION} AS frontend-build

ARG TARGETARCH

RUN --mount=type=cache,id=apk-${GOLANG_VERSION}-alpine${ALPINE_VERSION}-${TARGETARCH},target=/var/cache/apk \
    apk add \
        build-base git nodejs pnpm

WORKDIR /src

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm-${GOLANG_VERSION}-alpine${ALPINE_VERSION}-${TARGETARCH},target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY --exclude=.git/ . .

RUN --mount=type=cache,id=pnpm-${GOLANG_VERSION}-alpine${ALPINE_VERSION}-${TARGETARCH},target=/root/.local/share/pnpm/store \
    make frontend

# Build backend for each target platform
FROM docker.io/library/golang:${GOLANG_VERSION}-alpine${ALPINE_VERSION} AS build-env

ARG GITEA_VERSION
ARG TAGS=""
ENV TAGS="bindata timetzdata $TAGS"
ARG CGO_EXTRA_CFLAGS

# Build deps
RUN --mount=type=cache,id=apk-${GOLANG_VERSION}-alpine${ALPINE_VERSION}-${TARGETARCH},target=/var/cache/apk \
    apk add \
        build-base \
        git

WORKDIR ${GOPATH}/src/gitea.dev

COPY go.mod go.sum ./

RUN --mount=type=cache,id=go-mod-${GOLANG_VERSION}-alpine-${TARGETARCH},target=/go/pkg/mod \
    --mount=type=cache,id=go-build-${GOLANG_VERSION}-alpine-${TARGETARCH},target=/root/.cache/go-build \
    go mod download

# Use COPY instead of bind mount as read-only one breaks makefile state tracking and read-write one needs binary to be moved as it's discarded.
# ".git" directory is mounted separately later only for version data extraction.
COPY --exclude=.git/ . .
COPY --from=frontend-build /src/public/assets public/assets

# Build gitea, .git mount is required for version data
RUN --mount=type=cache,id=go-mod-${GOLANG_VERSION}-alpine-${TARGETARCH},target=/go/pkg/mod \
    --mount=type=cache,id=go-build-${GOLANG_VERSION}-alpine-${TARGETARCH},target=/root/.cache/go-build \
    --mount=type=bind,source=".git/",target=".git/" \
    make backend

COPY docker/root /tmp/local

# Set permissions for builds that made under windows which strips the executable bit from file
RUN chmod 755 /tmp/local/usr/bin/entrypoint \
              /tmp/local/usr/local/bin/* \
              /tmp/local/etc/s6/gitea/* \
              /tmp/local/etc/s6/openssh/* \
              /tmp/local/etc/s6/.s6-svscan/* \
              /go/src/gitea.dev/gitea

FROM docker.io/library/alpine:${ALPINE_VERSION} AS gitea

EXPOSE 22 3000

RUN --mount=type=cache,id=apk-${GOLANG_VERSION}-alpine${ALPINE_VERSION}-${TARGETARCH},target=/var/cache/apk \
    apk add \
        bash \
        ca-certificates \
        curl \
        gettext \
        git \
        linux-pam \
        openssh \
        s6 \
        sqlite \
        su-exec \
        gnupg

RUN addgroup -S -g 1000 git && \
  adduser \
    -S -H -D \
    -h /data/git \
    -s /bin/bash \
    -u 1000 \
    -G git \
    git && \
  echo "git:*" | chpasswd -e

COPY --from=build-env /tmp/local /
COPY --from=build-env /go/src/gitea.dev/gitea /app/gitea/gitea

ENV USER=git
ENV GITEA_CUSTOM=/data/gitea

VOLUME ["/data"]

# HINT: HEALTH-CHECK-ENDPOINT: don't use HEALTHCHECK, search this hint keyword for more information
ENTRYPOINT ["/usr/bin/entrypoint"]
CMD ["/usr/bin/s6-svscan", "/etc/s6"]
