FROM node:22-alpine AS builder
WORKDIR /app

ARG NODE_AUTH_TOKEN
COPY package*.json ./
COPY .npmrc ./
RUN echo "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}" >> .npmrc \
    && npm ci
    && rm .npmrc

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR app

COPY --from=builder app/dist ./dist
COPY --from=builder app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/server.js"]