ARG NODE_VERSION=26

# Node 26 images ship npm only; install the Yarn 1 that matches yarn.lock.
FROM node:${NODE_VERSION}-alpine AS base
RUN npm install -g yarn@1.22.22
WORKDIR /app

FROM base AS build
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --ignore-scripts
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN yarn build

FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --ignore-scripts \
  && yarn cache clean

FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
