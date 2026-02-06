FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Match the health check port you added in index.js (3301)
ENV PORT=3301
EXPOSE 3301

CMD ["npm", "start"]
