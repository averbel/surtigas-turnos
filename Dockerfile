FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=3001 DATA_DIR=/data
VOLUME /data
EXPOSE 3001
CMD ["node", "server/index.js"]
