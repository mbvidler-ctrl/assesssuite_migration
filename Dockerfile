# AssessSuite private demo — single container: Vite build + shim serving
# dist/ and the API from one origin. Synthetic data reseeds on every boot,
# so no persistent volume is required.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY --from=build /app /app
EXPOSE 8787
CMD ["sh", "-c", "node server/seed.mjs && node server/index.mjs"]
