FROM node:20-alpine AS base

# Install openssl for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci

# Copy application files
COPY . .

# Generate Prisma client and build application
RUN npx prisma generate
RUN npm run build

# Production settings
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "docker-start"]
