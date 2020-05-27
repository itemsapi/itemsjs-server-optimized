# docker build . -t itemsjs -f Dockerfile
# docker run --privileged -it -p 3000:3000 itemsjs /bin/bash
FROM node:12-alpine

RUN apk update && apk upgrade && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk add --no-cache bash lmdb-dev lmdb-tools boost libc6-compat gcompat build-base git 

COPY . /app/
RUN rm -Rf node_modules
RUN rm -Rf example.mdb
RUN mkdir -p example.mdb
WORKDIR app

RUN npm install
#RUN npm run build

