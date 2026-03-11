FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN chmod +x ./node_modules/.bin/tsc && ./node_modules/.bin/tsc

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]