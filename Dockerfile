# syntax = docker/dockerfile:1

FROM node:24-alpine

WORKDIR /app

# Only marked ships at runtime; vitest/jsdom/typescript stay out of the image.
COPY package.json pnpm-lock.yaml ./
RUN npm install --omit=dev marked@18.1.1

COPY src/ ./src/
COPY README.md ./README.md

ENV NODE_ENV=production
CMD ["node", "src/server.ts"]
