FROM node:22-bookworm-slim AS build

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Mount or COPY data/metadata.tsv before build in production
RUN npm run index-metadata -- --if-stale || true
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_STATIC=true
ENV PORT_INDEX=0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/data ./data
COPY --from=build /app/public ./public
COPY --from=build /app/ecosystem.config.cjs ./

EXPOSE 38471
CMD ["node", "dist-server/server/index.js"]
