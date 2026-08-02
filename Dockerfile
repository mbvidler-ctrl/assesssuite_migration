# AssessSuite — single container: Vite build + shim serving dist/ and the API
# from one origin. Production uses the persistent Fly volume and may bootstrap
# only the bounded, idempotent reference catalogues; demo tenants, users,
# legal receipts and clinical records are never part of production startup.
FROM node:24-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS build
ARG RELEASE_SHA
ARG SOURCE_BRANCH
ARG BUILD_TIMESTAMP
ARG SENTRY_DSN
WORKDIR /app
ENV RELEASE_SHA=${RELEASE_SHA} \
    SOURCE_BRANCH=${SOURCE_BRANCH} \
    BUILD_TIMESTAMP=${BUILD_TIMESTAMP} \
    VITE_BASE44_APP_ID=local-assesssuite \
    VITE_SENTRY_DSN=${SENTRY_DSN} \
    VITE_SENTRY_RELEASE=${RELEASE_SHA} \
    VITE_SENTRY_ENVIRONMENT=production
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN ./node_modules/.bin/sentry-cli sourcemaps inject /app/dist
# Source maps exist long enough for the no-secret release gate to prove their
# relationship to the runtime JavaScript. They are never copied into the
# runnable image; the deploy workflow rebuilds and uploads them separately.
RUN find /app -type f -name '*.map' -delete \
    && ! find /app -type f -name '*.map' -print -quit | grep -q .

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
