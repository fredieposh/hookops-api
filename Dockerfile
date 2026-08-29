FROM node:22.23.2-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
RUN --mount=type=secret,id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22.23.2-alpine AS runner
WORKDIR /app

COPY --from=builder app/dist ./dist
COPY --from=builder app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/server.js"]