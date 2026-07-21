# AssessSuite — single container: Vite build + shim serving dist/ and the API
# from one origin. Production uses the persistent Fly volume and may bootstrap
# only the bounded, idempotent reference catalogues; demo tenants, users,
# legal receipts and clinical records are never part of production startup.
FROM node:24-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS build
ARG RELEASE_SHA
ARG SOURCE_BRANCH
ARG BUILD_TIMESTAMP
WORKDIR /app
ENV RELEASE_SHA=${RELEASE_SHA} \
    SOURCE_BRANCH=${SOURCE_BRANCH} \
    BUILD_TIMESTAMP=${BUILD_TIMESTAMP} \
    VITE_BASE44_APP_ID=local-assesssuite
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d
ARG RELEASE_SHA
ARG SOURCE_BRANCH
ARG BUILD_TIMESTAMP
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    RELEASE_SHA=${RELEASE_SHA} \
    SOURCE_BRANCH=${SOURCE_BRANCH} \
    BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
COPY --from=build /app /app
EXPOSE 8787
CMD ["sh", "-c", "node server/productionBootstrap.mjs && exec node server/index.mjs"]
