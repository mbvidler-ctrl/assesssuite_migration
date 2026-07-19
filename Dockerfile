# AssessSuite private demo — single container: Vite build + shim serving
# dist/ and the API from one origin. Synthetic data reseeds on every boot,
# so no persistent volume is required.
FROM node:24-slim AS build
ARG RELEASE_SHA
ARG SOURCE_BRANCH
ARG BUILD_TIMESTAMP
WORKDIR /app
ENV RELEASE_SHA=${RELEASE_SHA} \
    SOURCE_BRANCH=${SOURCE_BRANCH} \
    BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
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
CMD ["sh", "-c", "node server/seed.mjs && node server/index.mjs"]
