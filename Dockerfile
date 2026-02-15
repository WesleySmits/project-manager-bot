FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Build TypeScript
RUN npm run build

# Match the health check port you added in index.js (3301)
ENV PORT=3301
EXPOSE 3301

CMD ["node", "dist/index.js"]
