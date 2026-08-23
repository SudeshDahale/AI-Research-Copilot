# Stage 1: Build the frontend application
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production runtime with static SPA server
FROM node:22-alpine AS runner

WORKDIR /app

ENV PORT=8080
ENV HOST=0.0.0.0

RUN npm install -g serve

COPY --from=builder /app/.output/public ./public

EXPOSE 8080

CMD ["serve", "-s", "public", "-l", "8080"]
